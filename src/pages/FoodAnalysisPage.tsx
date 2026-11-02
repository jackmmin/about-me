import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { today } from '../lib/format.ts'
import { analyzeFoods, listMeals, shiftDate, SYMPTOM_LABEL, SEVERITY_LABEL, type FoodStat } from '../lib/health.ts'
import { useLoad } from '../lib/useLoad.ts'

const RANGES = [
  { days: 30, label: '1개월' },
  { days: 90, label: '3개월' },
  { days: 180, label: '6개월' },
  { days: 0, label: '전체' },
]

// 이 횟수 미만으로 먹은 음식은 비율을 믿기 어려워 따로 모은다.
const MIN_COUNT = 3

const percent = (v: number) => `${Math.round(v * 100)}%`

export function FoodAnalysisPage() {
  const [days, setDays] = useState(90)
  const from = days ? shiftDate(today(), -(days - 1)) : null
  const { data: meals, error, loading } = useLoad(() => listMeals(from), [from])

  const result = meals ? analyzeFoods(meals) : null
  const enough = (result?.foods ?? []).filter((f) => f.count >= MIN_COUNT).sort((a, b) => b.rate - a.rate || b.count - a.count)
  const few = (result?.foods ?? []).filter((f) => f.count < MIN_COUNT).sort((a, b) => b.withSymptom - a.withSymptom || b.count - a.count)

  return (
    <section>
      <PageHeader
        title="음식-증상 분석"
        description="먹은 음식별로 식후 증상이 기록된 비율"
        actions={
          <Link to="/health" className="text-sm text-neutral-500">
            ← 기록
          </Link>
        }
      />

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

      {!result || result.totalMeals === 0 ? (
        <StatusMessage loading={loading} error={error} empty="이 기간에 음식을 기록한 끼니가 없습니다." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-xs text-neutral-500">기록한 끼니</p>
              <p className="mt-1 text-lg font-bold">{result.totalMeals}끼</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-xs text-neutral-500">전체 증상 비율 (기준선)</p>
              <p className="mt-1 text-lg font-bold">{percent(result.baselineRate)}</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-neutral-500">
            기준선보다 비율이 높게 표시된 음식이 의심 후보입니다. 같은 끼니에 함께 먹은 음식도 같이 집계되고, 증상은 기록한 끼니
            기준이라 다음 끼니에 늦게 나타난 증상은 반영되지 않습니다. 원인 진단이 아닌 참고용입니다.
          </p>

          <div>
            <h2 className="mb-2 font-semibold">
              {MIN_COUNT}회 이상 먹은 음식 <span className="text-sm font-normal text-neutral-500">· 증상 비율 높은 순</span>
            </h2>
            {enough.length === 0 ? (
              <StatusMessage empty={`아직 ${MIN_COUNT}회 이상 기록된 음식이 없습니다.`} />
            ) : (
              <ul className="flex flex-col gap-2">
                {enough.map((f) => (
                  <FoodRow key={f.food} stat={f} baseline={result.baselineRate} />
                ))}
              </ul>
            )}
          </div>

          {few.length > 0 && (
            <details className="rounded-xl border border-neutral-200 dark:border-neutral-800">
              <summary className="cursor-pointer px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                데이터 부족 ({MIN_COUNT}회 미만) · {few.length}개
              </summary>
              <ul className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
                {few.map((f) => (
                  <FoodRow key={f.food} stat={f} baseline={result.baselineRate} muted />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}

function FoodRow({ stat, baseline, muted }: { stat: FoodStat; baseline: number; muted?: boolean }) {
  // 기준선보다 10%p 이상 높으면 의심 후보로 표시한다. (색만으로 구분하지 않도록 라벨을 함께 쓴다)
  const suspect = !muted && stat.rate >= baseline + 0.1 && stat.withSymptom > 0
  return (
    <li className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          {stat.food}
          {suspect && <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white dark:bg-white dark:text-neutral-900">의심</span>}
        </p>
        <p className="shrink-0 text-sm tabular-nums">
          <span className="font-bold">{percent(stat.rate)}</span>
          <span className="ml-1 text-neutral-500">
            ({stat.withSymptom}/{stat.count}회)
          </span>
        </p>
      </div>
      {/* 증상 비율 막대: 기준선 위치를 세로선으로 표시 */}
      <div className="relative mt-2 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800" aria-hidden="true">
        <div className="h-full rounded-full bg-neutral-900 dark:bg-neutral-200" style={{ width: percent(stat.rate) }} />
        <div className="absolute -top-0.5 h-2.5 w-px bg-neutral-400" style={{ left: percent(baseline) }} />
      </div>
      {stat.symptoms.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          {stat.symptoms.map((s) => `${SYMPTOM_LABEL[s.key]} ${s.count}`).join(' · ')}
          {stat.avgSeverity !== null && ` · 평균 정도 ${SEVERITY_LABEL[Math.round(stat.avgSeverity)]}`}
        </p>
      )}
    </li>
  )
}
