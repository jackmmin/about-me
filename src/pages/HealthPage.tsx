import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ExerciseList } from '../components/health/ExerciseList.tsx'
import { MealCard } from '../components/health/MealCard.tsx'
import { Section } from '../components/health/Section.tsx'
import { fieldClass, secondaryClass } from '../components/styles.ts'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { formatDate, today } from '../lib/format.ts'
import { getHealthDay, listExerciseKinds, listFoodNames, listHealthRange, MEALS, shiftDate } from '../lib/health.ts'
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
    [...(recent.data?.exercises ?? []), ...(recent.data?.meals ?? [])].map((r) => r.log_date),
  )
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(today(), i - 6))

  return (
    <section>
      <PageHeader
        title="건강"
        description="식단과 운동 기록"
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
