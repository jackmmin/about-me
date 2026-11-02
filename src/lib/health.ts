import { supabase } from './supabase.ts'

// 화면에서 쓰는 항목만 다룬다. (걸음 수·컨디션·복용약·병원·메모 칸은 DB에 남아 있지만 더 이상 쓰지 않는다.)
// upsert도 이 항목만 보내므로 기존에 남아 있는 값은 그대로 보존된다.
export interface HealthLog {
  log_date: string
  bed_at: string | null
  wake_at: string | null
  sleep_minutes: number | null
  sleep_quality: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_kg: number | null
}

export interface ExerciseLog {
  id: string
  log_date: string
  kind: string
  minutes: number
  intensity: number | null
  memo: string
}

export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type SymptomKey = 'diarrhea' | 'bloating' | 'pain' | 'gas' | 'constipation' | 'nausea'

export const MEALS: { key: MealKey; label: string }[] = [
  { key: 'breakfast', label: '아침' },
  { key: 'lunch', label: '점심' },
  { key: 'dinner', label: '저녁' },
  { key: 'snack', label: '간식' },
]

export const SYMPTOMS: { key: SymptomKey; label: string }[] = [
  { key: 'diarrhea', label: '설사' },
  { key: 'bloating', label: '복부팽만' },
  { key: 'pain', label: '복통' },
  { key: 'gas', label: '가스' },
  { key: 'constipation', label: '변비' },
  { key: 'nausea', label: '구역감' },
]
export const SYMPTOM_LABEL = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label])) as Record<SymptomKey, string>
export const MEAL_LABEL = Object.fromEntries(MEALS.map((m) => [m.key, m.label])) as Record<MealKey, string>
export const SEVERITY_LABEL: Record<number, string> = { 1: '약', 2: '중', 3: '강' }

export interface MealLog {
  log_date: string
  meal: MealKey
  foods: string[]
  symptoms: SymptomKey[]
  severity: number | null
  note: string
}

const LOG_COLUMNS = 'log_date, bed_at, wake_at, sleep_minutes, sleep_quality, weight_kg, body_fat_pct, muscle_kg'
const MEAL_COLUMNS = 'log_date, meal, foods, symptoms, severity, note'

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
  const [log, exercises, meals] = await Promise.all([
    supabase.from('health_logs').select(LOG_COLUMNS).eq('log_date', date).maybeSingle(),
    supabase.from('exercise_logs').select('*').eq('log_date', date).order('created_at'),
    supabase.from('meal_logs').select(MEAL_COLUMNS).eq('log_date', date),
  ])
  if (log.error) throw log.error
  if (exercises.error) throw exercises.error
  if (meals.error) throw meals.error
  return {
    log: log.data ? normalize(log.data) : null,
    exercises: exercises.data as ExerciseLog[],
    meals: meals.data as MealLog[],
  }
}

export async function listHealthRange(from: string, to: string) {
  const [logs, exercises, meals] = await Promise.all([
    supabase.from('health_logs').select(LOG_COLUMNS).gte('log_date', from).lte('log_date', to).order('log_date'),
    supabase.from('exercise_logs').select('*').gte('log_date', from).lte('log_date', to).order('log_date'),
    supabase.from('meal_logs').select(MEAL_COLUMNS).gte('log_date', from).lte('log_date', to).order('log_date'),
  ])
  if (logs.error) throw logs.error
  if (exercises.error) throw exercises.error
  if (meals.error) throw meals.error
  return { logs: logs.data.map(normalize), exercises: exercises.data as ExerciseLog[], meals: meals.data as MealLog[] }
}

// 하루 한 행: 같은 날짜로 저장하면 덮어쓴다.
export async function saveHealthLog(log: HealthLog) {
  const { error } = await supabase.from('health_logs').upsert(log, { onConflict: 'user_id,log_date' })
  if (error) throw error
}

// 하루 끼니당 한 행. 음식·증상·메모가 모두 비면 행을 지운다.
export async function saveMeal(meal: MealLog) {
  const empty = meal.foods.length === 0 && meal.symptoms.length === 0 && !meal.note
  const { error } = empty
    ? await supabase.from('meal_logs').delete().eq('log_date', meal.log_date).eq('meal', meal.meal)
    : await supabase.from('meal_logs').upsert(meal, { onConflict: 'user_id,log_date,meal' })
  if (error) throw error
}

// 음식 자동완성용: 최근 끼니에서 자주 먹은 순
export async function listFoodNames() {
  const { data, error } = await supabase.from('meal_logs').select('foods').order('log_date', { ascending: false }).limit(300)
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data) for (const f of row.foods as string[]) counts.set(f, (counts.get(f) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

export async function listMeals(from: string | null) {
  let query = supabase.from('meal_logs').select(MEAL_COLUMNS).order('log_date')
  if (from) query = query.gte('log_date', from)
  const { data, error } = await query
  if (error) throw error
  return data as MealLog[]
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

// ---- 음식-증상 분석 ----

export interface FoodStat {
  food: string
  count: number // 먹은 끼니 수
  withSymptom: number // 그중 증상이 기록된 끼니 수
  rate: number // withSymptom / count
  symptoms: { key: SymptomKey; count: number }[] // 많이 나타난 순
  avgSeverity: number | null
}

export function analyzeFoods(meals: MealLog[]) {
  const withFood = meals.filter((m) => m.foods.length > 0)
  const baselineRate = withFood.length ? withFood.filter((m) => m.symptoms.length > 0).length / withFood.length : 0

  const stats = new Map<string, { count: number; withSymptom: number; symptoms: Map<SymptomKey, number>; severities: number[] }>()
  for (const m of withFood) {
    for (const food of new Set(m.foods)) {
      const s = stats.get(food) ?? { count: 0, withSymptom: 0, symptoms: new Map<SymptomKey, number>(), severities: [] as number[] }
      s.count++
      if (m.symptoms.length > 0) {
        s.withSymptom++
        for (const sym of m.symptoms) s.symptoms.set(sym, (s.symptoms.get(sym) ?? 0) + 1)
        if (m.severity) s.severities.push(m.severity)
      }
      stats.set(food, s)
    }
  }

  const foods: FoodStat[] = [...stats].map(([food, s]) => ({
    food,
    count: s.count,
    withSymptom: s.withSymptom,
    rate: s.withSymptom / s.count,
    symptoms: [...s.symptoms].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    avgSeverity: s.severities.length ? s.severities.reduce((a, b) => a + b, 0) / s.severities.length : null,
  }))
  return { totalMeals: withFood.length, baselineRate, foods }
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

// ---- 검색 ----

export interface HealthMatch {
  log_date: string
  field: string
  text: string
}

// 식단(음식·증상 메모)과 운동(종류·메모)에서 검색. 날짜 최신순.
// 음식은 배열이라 부분 일치 검색이 안 되므로 최근 끼니를 받아와 앱에서 거른다.
export async function searchHealth(term: string, limit = 50) {
  if (!term) return []
  const lower = term.toLowerCase()
  const [meals, exercises] = await Promise.all([
    supabase.from('meal_logs').select(MEAL_COLUMNS).order('log_date', { ascending: false }).limit(1000),
    supabase
      .from('exercise_logs')
      .select('log_date, kind, memo')
      .or(`kind.ilike.%${term}%,memo.ilike.%${term}%`)
      .order('log_date', { ascending: false })
      .limit(limit),
  ])
  if (meals.error) throw meals.error
  if (exercises.error) throw exercises.error

  const matches: HealthMatch[] = []
  for (const m of meals.data as MealLog[]) {
    if (!m.foods.some((f) => f.toLowerCase().includes(lower)) && !m.note.toLowerCase().includes(lower)) continue
    const symptoms = m.symptoms.map((s) => SYMPTOM_LABEL[s]).join(', ')
    matches.push({
      log_date: m.log_date,
      field: `식단 · ${MEAL_LABEL[m.meal]}`,
      text: [m.foods.join(', '), symptoms && `증상: ${symptoms}`, m.note].filter(Boolean).join(' · '),
    })
  }
  for (const ex of exercises.data) {
    matches.push({ log_date: ex.log_date as string, field: '운동', text: [ex.kind, ex.memo].filter(Boolean).join(' · ') })
  }
  return matches.sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, limit)
}
