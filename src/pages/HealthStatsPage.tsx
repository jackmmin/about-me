import { useState } from 'react'
import { Link } from 'react-router'
import { ChartCard, DailyBarChart, type ChartRow, type SeriesDef } from '../components/charts.tsx'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { today } from '../lib/format.ts'
import { dateRange, listHealthRange, shiftDate, type ExerciseLog, type MealLog } from '../lib/health.ts'
import { useLoad } from '../lib/useLoad.ts'

const RANGES = [
  { days: 7, label: '1주' },
  { days: 30, label: '1개월' },
  { days: 90, label: '3개월' },
  { days: 365, label: '1년' },
]

const EXERCISE: SeriesDef = { key: 'exercise_minutes', name: '운동', format: (v) => `${Math.round(v)}분` }
const SYMPTOM_MEALS: SeriesDef = { key: 'symptom_meals', name: '증상 있던 끼니', format: (v) => `${Math.round(v)}끼` }

function buildRows(dates: string[], exercises: ExerciseLog[], meals: MealLog[]): ChartRow[] {
  const minutes = new Map<string, number>()
  for (const e of exercises) minutes.set(e.log_date, (minutes.get(e.log_date) ?? 0) + e.minutes)
  const symptomMeals = new Map<string, number>()
  for (const m of meals) if (m.symptoms.length > 0) symptomMeals.set(m.log_date, (symptomMeals.get(m.log_date) ?? 0) + 1)
  return dates.map((date) => ({
    date,
    exercise_minutes: minutes.get(date) ?? null,
    symptom_meals: symptomMeals.get(date) ?? null,
  }))
}

function total(rows: ChartRow[], key: string) {
  return rows.reduce((sum, r) => sum + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0)
}

export function HealthStatsPage() {
  const [days, setDays] = useState(30)
  const [showTable, setShowTable] = useState(false)

  const end = today()
  const start = shiftDate(end, -(days - 1))
  const prevStart = shiftDate(start, -days)
  // 직전 기간과 비교하기 위해 두 기간을 한 번에 불러온다.
  const { data, error, loading } = useLoad(() => listHealthRange(prevStart, end), [days, end], `stats:${days}:${end}`)

  const rows = data ? buildRows(dateRange(start, end), data.exercises, data.meals) : []
  const prevRows = data ? buildRows(dateRange(prevStart, shiftDate(start, -1)), data.exercises, data.meals) : []
  const hasData = rows.some((r) => r.exercise_minutes !== null || r.symptom_meals !== null)

  const tiles = [
    { label: '총 운동', cur: total(rows, 'exercise_minutes'), prev: total(prevRows, 'exercise_minutes'), format: EXERCISE.format },
    { label: '증상 있던 끼니', cur: total(rows, 'symptom_meals'), prev: total(prevRows, 'symptom_meals'), format: SYMPTOM_MEALS.format },
  ]

  return (
    <section>
      <PageHeader
        title="건강 그래프"
        actions={
          <Link to="/health" className="text-sm text-neutral-500">
            ← 기록
          </Link>
        }
      />

      {/* 필터는 차트 위 한 줄 */}
      <div className="mb-4 flex gap-1.5" role="radiogroup" aria-label="기간">
        {RANGES.map((r) => (
          <button
            key={r.days}
            role="radio"
            aria-checked={days === r.days}
            className={`rounded-full px-3 py-1 text-sm ${
              days === r.days ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <StatusMessage loading={loading} error={error} empty="이 기간에 건강 기록이 없습니다." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((t) => (
              <StatTile key={t.label} {...t} />
            ))}
          </div>

          <ChartCard title="운동 시간">
            <DailyBarChart data={rows} series={EXERCISE} />
          </ChartCard>

          <ChartCard title="식후 증상">
            <DailyBarChart data={rows} series={SYMPTOM_MEALS} />
          </ChartCard>

          <button className="text-sm text-neutral-500 underline-offset-4 hover:underline" onClick={() => setShowTable(!showTable)}>
            {showTable ? '표 닫기' : '표로 보기'}
          </button>
          {showTable && <DataTable rows={rows} />}
        </div>
      )}
    </section>
  )
}

function StatTile({ label, cur, prev, format }: { label: string; cur: number; prev: number; format: (v: number) => string }) {
  const delta = prev !== 0 ? cur - prev : null
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{format(cur)}</p>
      {delta !== null && delta !== 0 && (
        <p className="text-xs text-neutral-500">
          직전 기간 대비 {delta > 0 ? '▲' : '▼'} {format(Math.abs(delta))}
        </p>
      )}
    </div>
  )
}

function DataTable({ rows }: { rows: ChartRow[] }) {
  const recorded = rows.filter((r) => r.exercise_minutes !== null || r.symptom_meals !== null).reverse()
  const cell = (v: unknown, f: (n: number) => string) => (typeof v === 'number' ? f(v) : '-')
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-right text-xs tabular-nums">
        <thead className="text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="p-2 text-left font-normal">날짜</th>
            <th className="p-2 font-normal">운동</th>
            <th className="p-2 font-normal">증상</th>
          </tr>
        </thead>
        <tbody>
          {recorded.map((r) => (
            <tr key={r.date} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
              <td className="p-2 text-left">{r.date.slice(5)}</td>
              <td className="p-2">{cell(r.exercise_minutes, EXERCISE.format)}</td>
              <td className="p-2">{cell(r.symptom_meals, SYMPTOM_MEALS.format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
