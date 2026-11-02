import { supabase } from './supabase.ts'

export interface HealthLog {
  log_date: string
  bed_at: string | null
  wake_at: string | null
  sleep_minutes: number | null
  sleep_quality: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_kg: number | null
  steps: number | null
  condition_score: number | null
  meals: string
  medications: string
  hospital_visit: string
  memo: string
}

export interface ExerciseLog {
  id: string
  log_date: string
  kind: string
  minutes: number
  intensity: number | null
  memo: string
}

const LOG_COLUMNS =
  'log_date, bed_at, wake_at, sleep_minutes, sleep_quality, weight_kg, body_fat_pct, muscle_kg, steps, condition_score, meals, medications, hospital_visit, memo'

// PostgREST는 numeric을 문자열로 줄 수 있어 숫자로 맞춘다.
function normalize(row: Record<string, unknown>): HealthLog {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    ...(row as unknown as HealthLog),
    weight_kg: num(row.weight_kg),
    body_fat_pct: num(row.body_fat_pct),
    muscle_kg: num(row.muscle_kg),
  }
}

export async function getHealthDay(date: string) {
  const [log, exercises] = await Promise.all([
    supabase.from('health_logs').select(LOG_COLUMNS).eq('log_date', date).maybeSingle(),
    supabase.from('exercise_logs').select('*').eq('log_date', date).order('created_at'),
  ])
  if (log.error) throw log.error
  if (exercises.error) throw exercises.error
  return { log: log.data ? normalize(log.data) : null, exercises: exercises.data as ExerciseLog[] }
}

export async function listHealthRange(from: string, to: string) {
  const [logs, exercises] = await Promise.all([
    supabase.from('health_logs').select(LOG_COLUMNS).gte('log_date', from).lte('log_date', to).order('log_date'),
    supabase.from('exercise_logs').select('*').gte('log_date', from).lte('log_date', to).order('log_date'),
  ])
  if (logs.error) throw logs.error
  if (exercises.error) throw exercises.error
  return { logs: logs.data.map(normalize), exercises: exercises.data as ExerciseLog[] }
}

// 하루 한 행: 같은 날짜로 저장하면 덮어쓴다.
export async function saveHealthLog(log: HealthLog) {
  const { error } = await supabase.from('health_logs').upsert(log, { onConflict: 'user_id,log_date' })
  if (error) throw error
}

export async function deleteHealthLog(date: string) {
  const { error } = await supabase.from('health_logs').delete().eq('log_date', date)
  if (error) throw error
}

export async function addExercise(exercise: Omit<ExerciseLog, 'id'>) {
  const { error } = await supabase.from('exercise_logs').insert(exercise)
  if (error) throw error
}

export async function deleteExercise(id: string) {
  const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
  if (error) throw error
}

export async function listExerciseKinds() {
  const { data, error } = await supabase.from('exercise_logs').select('kind').order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return [...new Set(data.map((d) => d.kind as string))]
}

// ---- 수면 시각 계산 ----

// 취침 시각이 정오 이후면 전날 밤으로 본다 (예: 23:30 → 전날, 01:00 → 당일).
export function sleepTimestamps(date: string, bed: string, wake: string) {
  if (!bed || !wake) return null
  const bedDate = bed >= '12:00' ? shiftDate(date, -1) : date
  const bedAt = new Date(`${bedDate}T${bed}`)
  const wakeAt = new Date(`${date}T${wake}`)
  const minutes = Math.round((wakeAt.getTime() - bedAt.getTime()) / 60000)
  if (minutes <= 0 || minutes > 24 * 60) return null
  return { bed_at: bedAt.toISOString(), wake_at: wakeAt.toISOString(), sleep_minutes: minutes }
}

// timestamptz → 현지 'HH:MM'
export function localTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatMinutes(minutes: number | null) {
  if (minutes === null) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

// 'YYYY-MM-DD'에 일 수를 더한다 (UTC 기준이라 시간대 영향 없음).
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function dateRange(from: string, to: string) {
  const dates: string[] = []
  for (let d = from; d <= to; d = shiftDate(d, 1)) dates.push(d)
  return dates
}

export interface HealthMatch {
  log_date: string
  field: string
  text: string
}

const HEALTH_TEXT_FIELDS: Record<string, string> = {
  meals: '식단',
  medications: '복용약',
  hospital_visit: '병원',
  memo: '메모',
}

// 건강 기록의 글 항목(식단·복용약·병원·메모)과 운동 종류·메모에서 검색. 날짜 최신순.
export async function searchHealth(term: string, limit = 50) {
  if (!term) return []
  const pattern = `%${term}%`
  const fields = Object.keys(HEALTH_TEXT_FIELDS)
  const [logs, exercises] = await Promise.all([
    supabase
      .from('health_logs')
      .select(`log_date, ${fields.join(', ')}`)
      .or(fields.map((f) => `${f}.ilike.${pattern}`).join(','))
      .order('log_date', { ascending: false })
      .limit(limit),
    supabase
      .from('exercise_logs')
      .select('log_date, kind, memo')
      .or(`kind.ilike.${pattern},memo.ilike.${pattern}`)
      .order('log_date', { ascending: false })
      .limit(limit),
  ])
  if (logs.error) throw logs.error
  if (exercises.error) throw exercises.error

  const lower = term.toLowerCase()
  const matches: HealthMatch[] = []
  for (const row of logs.data as unknown as Record<string, string>[]) {
    const field = fields.find((f) => row[f]?.toLowerCase().includes(lower))
    if (field) matches.push({ log_date: row.log_date, field: HEALTH_TEXT_FIELDS[field], text: row[field] })
  }
  for (const ex of exercises.data) {
    matches.push({ log_date: ex.log_date as string, field: '운동', text: [ex.kind, ex.memo].filter(Boolean).join(' · ') })
  }
  return matches.sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, limit)
}
