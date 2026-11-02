import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ExerciseList } from '../components/health/ExerciseList.tsx'
import { ScoreInput } from '../components/health/ScoreInput.tsx'
import { Section } from '../components/health/Section.tsx'
import { fieldClass, primaryClass, secondaryClass } from '../components/styles.ts'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { formatDate, today } from '../lib/format.ts'
import {
  formatMinutes,
  getHealthDay,
  listExerciseKinds,
  listHealthRange,
  localTime,
  saveHealthLog,
  shiftDate,
  sleepTimestamps,
  type HealthLog,
} from '../lib/health.ts'
import { useLoad } from '../lib/useLoad.ts'

const WEEKDAY = new Intl.DateTimeFormat('ko-KR', { weekday: 'narrow', timeZone: 'UTC' })

export function HealthPage() {
  const [date, setDate] = useState(today())
  // 불러온 날짜를 같이 들고 있어서, 날짜를 바꾼 직후 이전 날짜 데이터로 폼이 그려지지 않게 한다.
  const day = useLoad(async () => ({ date, ...(await getHealthDay(date)) }), [date])
  const recent = useLoad(() => listHealthRange(shiftDate(today(), -6), today()), [day.data])
  const { data: kinds } = useLoad(listExerciseKinds, [day.data])

  const recorded = new Set([...(recent.data?.logs ?? []), ...(recent.data?.exercises ?? [])].map((r) => r.log_date))
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(today(), i - 6))

  return (
    <section>
      <PageHeader
        title="건강"
        description="하루 한 번, 오늘의 몸 상태"
        actions={
          <Link to="/health/stats" className={secondaryClass}>
            그래프
          </Link>
        }
      />

      {/* 최근 7일: 기록한 날은 점으로 표시, 누르면 그날로 이동 */}
      <div className="mb-4 grid grid-cols-7 gap-1 text-center">
        {week.map((d) => (
          <button
            key={d}
            type="button"
            className={`rounded-lg py-1.5 text-xs ${d === date ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}
            onClick={() => setDate(d)}
          >
            <span className="block opacity-60">{WEEKDAY.format(new Date(`${d}T00:00:00Z`))}</span>
            <span className="block font-semibold">{Number(d.slice(8))}</span>
            <span className={`mx-auto mt-0.5 block size-1.5 rounded-full ${recorded.has(d) ? 'bg-current' : ''}`} />
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button type="button" className={secondaryClass} onClick={() => setDate(shiftDate(date, -1))} aria-label="전날">
          ◀
        </button>
        <input type="date" className={`${fieldClass} flex-1`} value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button
          type="button"
          className={secondaryClass}
          disabled={date >= today()}
          onClick={() => setDate(shiftDate(date, 1))}
          aria-label="다음날"
        >
          ▶
        </button>
      </div>
      <p className="mb-4 text-sm text-neutral-500">{formatDate(date)}</p>

      {day.data?.date !== date ? (
        <StatusMessage loading={day.loading} error={day.error} />
      ) : (
        <div className="flex flex-col gap-3">
          <HealthForm key={date} date={date} initial={day.data.log} onSaved={day.reload} />
          <Section title="운동" summary={exerciseSummary(day.data.exercises.map((e) => e.minutes))} defaultOpen>
            <ExerciseList date={date} exercises={day.data.exercises} kinds={kinds ?? []} onChange={day.reload} />
          </Section>
        </div>
      )}
    </section>
  )
}

function exerciseSummary(minutes: number[]) {
  if (minutes.length === 0) return ''
  return `${minutes.length}건 · ${minutes.reduce((a, b) => a + b, 0)}분`
}

// 입력값은 문자열로 들고 있다가 저장할 때 숫자/null로 바꾼다.
interface Draft {
  bed: string
  wake: string
  sleep_quality: number | null
  weight_kg: string
  body_fat_pct: string
  muscle_kg: string
  steps: string
  condition_score: number | null
  meals: string
  medications: string
  hospital_visit: string
  memo: string
}

function toDraft(log: HealthLog | null): Draft {
  const s = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
  return {
    bed: localTime(log?.bed_at ?? null),
    wake: localTime(log?.wake_at ?? null),
    sleep_quality: log?.sleep_quality ?? null,
    weight_kg: s(log?.weight_kg),
    body_fat_pct: s(log?.body_fat_pct),
    muscle_kg: s(log?.muscle_kg),
    steps: s(log?.steps),
    condition_score: log?.condition_score ?? null,
    meals: log?.meals ?? '',
    medications: log?.medications ?? '',
    hospital_visit: log?.hospital_visit ?? '',
    memo: log?.memo ?? '',
  }
}

function HealthForm({ date, initial, onSaved }: { date: string; initial: HealthLog | null; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => toDraft(initial))
  const [status, setStatus] = useState<{ pending?: boolean; message?: string; error?: boolean }>({})
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setStatus({})
  }

  const sleep = sleepTimestamps(date, draft.bed, draft.wake)
  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if ((draft.bed || draft.wake) && !sleep) return setStatus({ error: true, message: '취침·기상 시각을 확인하세요.' })
    const values = [draft.weight_kg, draft.body_fat_pct, draft.muscle_kg, draft.steps].map(num)
    if (values.some((v) => v !== null && (Number.isNaN(v) || v < 0))) return setStatus({ error: true, message: '숫자 항목을 확인하세요.' })
    setStatus({ pending: true })
    try {
      await saveHealthLog({
        log_date: date,
        bed_at: sleep?.bed_at ?? null,
        wake_at: sleep?.wake_at ?? null,
        sleep_minutes: sleep?.sleep_minutes ?? null,
        sleep_quality: draft.sleep_quality,
        weight_kg: values[0],
        body_fat_pct: values[1],
        muscle_kg: values[2],
        steps: values[3] === null ? null : Math.round(values[3]),
        condition_score: draft.condition_score,
        meals: draft.meals.trim(),
        medications: draft.medications.trim(),
        hospital_visit: draft.hospital_visit.trim(),
        memo: draft.memo.trim(),
      })
      setStatus({ message: '저장했습니다.' })
      onSaved()
    } catch (err) {
      setStatus({ error: true, message: err instanceof Error ? err.message : String(err) })
    }
  }

  const bodySummary = [draft.weight_kg && `${draft.weight_kg}kg`, draft.body_fat_pct && `${draft.body_fat_pct}%`].filter(Boolean).join(' · ')

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <Section title="수면" summary={sleep ? formatMinutes(sleep.sleep_minutes) : ''} defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-neutral-600 dark:text-neutral-400">
            취침 (전날 밤)
            <input type="time" className={`${fieldClass} mt-1`} value={draft.bed} onChange={(e) => set('bed', e.target.value)} />
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-400">
            기상
            <input type="time" className={`${fieldClass} mt-1`} value={draft.wake} onChange={(e) => set('wake', e.target.value)} />
          </label>
        </div>
        <ScoreInput label="수면 질" value={draft.sleep_quality} onChange={(v) => set('sleep_quality', v)} low="나쁨" high="좋음" />
      </Section>

      <Section title="체중·체성분" summary={bodySummary}>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="체중 (kg)" value={draft.weight_kg} onChange={(v) => set('weight_kg', v)} />
          <NumberField label="체지방률 (%)" value={draft.body_fat_pct} onChange={(v) => set('body_fat_pct', v)} />
          <NumberField label="골격근량 (kg)" value={draft.muscle_kg} onChange={(v) => set('muscle_kg', v)} />
        </div>
      </Section>

      <Section title="활동" summary={draft.steps && `${Number(draft.steps).toLocaleString()}보`}>
        <NumberField label="걸음 수" value={draft.steps} onChange={(v) => set('steps', v)} integer />
      </Section>

      <Section title="컨디션·식단·병원" summary={draft.condition_score ? `컨디션 ${draft.condition_score}` : ''} defaultOpen>
        <ScoreInput label="컨디션" value={draft.condition_score} onChange={(v) => set('condition_score', v)} low="나쁨" high="좋음" />
        <TextField label="식단" value={draft.meals} onChange={(v) => set('meals', v)} placeholder="아침·점심·저녁" />
        <TextField label="복용약" value={draft.medications} onChange={(v) => set('medications', v)} />
        <TextField label="병원 방문" value={draft.hospital_visit} onChange={(v) => set('hospital_visit', v)} placeholder="병원, 진료 내용" />
        <TextField label="메모" value={draft.memo} onChange={(v) => set('memo', v)} />
      </Section>

      <button className={primaryClass} disabled={status.pending}>
        {status.pending ? '저장 중…' : initial ? '수정 저장' : '저장'}
      </button>
      {status.message && (
        <p className={`text-center text-sm ${status.error ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>{status.message}</p>
      )}
    </form>
  )
}

function NumberField({ label, value, onChange, integer }: { label: string; value: string; onChange: (v: string) => void; integer?: boolean }) {
  return (
    <label className="text-sm text-neutral-600 dark:text-neutral-400">
      {label}
      <input
        className={`${fieldClass} mt-1`}
        inputMode={integer ? 'numeric' : 'decimal'}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(integer ? /\D/g : /[^\d.]/g, ''))}
      />
    </label>
  )
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-sm text-neutral-600 dark:text-neutral-400">
      {label}
      <textarea
        rows={2}
        className={`${fieldClass} mt-1 resize-y`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
