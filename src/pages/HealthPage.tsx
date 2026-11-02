import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ExerciseList } from '../components/health/ExerciseList.tsx'
import { MealCard } from '../components/health/MealCard.tsx'
import { ScoreInput } from '../components/health/ScoreInput.tsx'
import { Section } from '../components/health/Section.tsx'
import { fieldClass, primaryClass, secondaryClass } from '../components/styles.ts'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { formatDate, today } from '../lib/format.ts'
import {
  formatMinutes,
  getHealthDay,
  listExerciseKinds,
  listFoodNames,
  listHealthRange,
  MEALS,
  localTime,
  saveHealthLog,
  shiftDate,
  sleepTimestamps,
  type HealthLog,
} from '../lib/health.ts'
import { useLoad } from '../lib/useLoad.ts'

const WEEKDAY = new Intl.DateTimeFormat('ko-KR', { weekday: 'narrow', timeZone: 'UTC' })

export function HealthPage() {
  // 검색 결과 등에서 /health?date=YYYY-MM-DD로 들어오면 그 날짜를 연다.
  const [params] = useSearchParams()
  const [date, setDate] = useState(() => {
    const d = params.get('date')
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today() ? d : today()
  })
  // 불러온 날짜를 같이 들고 있어서, 날짜를 바꾼 직후 이전 날짜 데이터로 폼이 그려지지 않게 한다.
  const day = useLoad(async () => ({ date, ...(await getHealthDay(date)) }), [date])
  const recent = useLoad(() => listHealthRange(shiftDate(today(), -6), today()), [day.data])
  const { data: kinds } = useLoad(listExerciseKinds, [day.data])
  const { data: foods } = useLoad(listFoodNames, [day.data])

  const recorded = new Set(
    [...(recent.data?.logs ?? []), ...(recent.data?.exercises ?? []), ...(recent.data?.meals ?? [])].map((r) => r.log_date),
  )
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(today(), i - 6))

  return (
    <section>
      <PageHeader
        title="건강"
        description="하루 한 번, 오늘의 몸 상태"
        actions={
          <>
            <Link to="/health/foods" className={secondaryClass}>
              음식 분석
            </Link>
            <Link to="/health/stats" className={secondaryClass}>
              그래프
            </Link>
          </>
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
          <Section title="식단" summary={mealSummary(day.data.meals)} defaultOpen>
            {MEALS.map((m) => (
              <MealCard
                key={`${date}-${m.key}`}
                date={date}
                meal={m.key}
                label={m.label}
                initial={day.data?.meals.find((x) => x.meal === m.key)}
                foodSuggestions={foods ?? []}
                onSaved={day.reload}
              />
            ))}
          </Section>
          <Section title="운동" summary={exerciseSummary(day.data.exercises.map((e) => e.minutes))} defaultOpen>
            <ExerciseList date={date} exercises={day.data.exercises} kinds={kinds ?? []} onChange={day.reload} />
          </Section>
        </div>
      )}
    </section>
  )
}

function mealSummary(meals: { foods: string[]; symptoms: string[] }[]) {
  if (meals.length === 0) return ''
  const withSymptom = meals.filter((m) => m.symptoms.length > 0).length
  return `${meals.length}끼${withSymptom ? ` · 증상 ${withSymptom}` : ''}`
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
    const values = [draft.weight_kg, draft.body_fat_pct, draft.muscle_kg].map(num)
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

      <button className={primaryClass} disabled={status.pending}>
        {status.pending ? '저장 중…' : '수면·체성분 저장'}
      </button>
      {status.message && (
        <p className={`text-center text-sm ${status.error ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>{status.message}</p>
      )}
    </form>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-sm text-neutral-600 dark:text-neutral-400">
      {label}
      <input
        className={`${fieldClass} mt-1`}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      />
    </label>
  )
}
