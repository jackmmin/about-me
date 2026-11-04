import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ExerciseList } from '../components/health/ExerciseList.tsx'
import { MealCard } from '../components/health/MealCard.tsx'
import { SnackList } from '../components/health/SnackList.tsx'
import { fieldClass, secondaryClass } from '../components/styles.ts'
import { Tabs } from '../components/Tabs.tsx'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { formatDate, today } from '../lib/format.ts'
import { getHealthDay, listExerciseKinds, listFoodNames, listHealthRange, MEALS, shiftDate, type MealKey } from '../lib/health.ts'
import { useLoad } from '../lib/useLoad.ts'

const WEEKDAY = new Intl.DateTimeFormat('ko-KR', { weekday: 'narrow', timeZone: 'UTC' })

type Tab = 'meals' | 'exercise'

// 오늘이면 지금 시각에 맞는 끼니, 지난 날짜면 아침부터
function defaultMeal(date: string): MealKey {
  if (date !== today()) return 'breakfast'
  const h = new Date().getHours()
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

export function HealthPage() {
  // 날짜·탭·끼니를 주소(?date=&tab=&meal=)에 남겨 새로고침·뒤로 가기·검색 결과 이동에도 유지한다.
  const [params, setParams] = useSearchParams()
  const [date, setDateState] = useState(() => {
    const d = params.get('date')
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today() ? d : today()
  })
  const tab: Tab = params.get('tab') === 'exercise' ? 'exercise' : 'meals'
  const mealParam = params.get('meal')
  const meal = MEALS.some((m) => m.key === mealParam) ? (mealParam as MealKey) : defaultMeal(date)

  const updateParams = (next: { date?: string; tab?: Tab; meal?: MealKey }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        const d = next.date ?? date
        if (d === today()) p.delete('date')
        else p.set('date', d)
        p.set('tab', next.tab ?? tab)
        p.set('meal', next.meal ?? meal)
        return p
      },
      { replace: true },
    )
  const setDate = (d: string) => {
    setDateState(d)
    updateParams({ date: d })
  }

  // 불러온 날짜를 같이 들고 있어서, 날짜를 바꾼 직후 이전 날짜 데이터로 폼이 그려지지 않게 한다.
  const day = useLoad(async () => ({ date, ...(await getHealthDay(date)) }), [date])
  const recent = useLoad(() => listHealthRange(shiftDate(today(), -6), today()), [day.data])
  const { data: kinds } = useLoad(listExerciseKinds, [day.data])
  const { data: foods } = useLoad(listFoodNames, [day.data])

  const recorded = new Set([...(recent.data?.exercises ?? []), ...(recent.data?.meals ?? [])].map((r) => r.log_date))
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(today(), i - 6))
  const loaded = day.data?.date === date ? day.data : null

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

      {!loaded ? (
        <StatusMessage loading={day.loading} error={day.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <Tabs
            label="건강 기록 종류"
            value={tab}
            onChange={(t) => updateParams({ tab: t })}
            items={[
              { key: 'meals', label: '식단', badge: loaded.meals.length > 0 && <Count n={loaded.meals.length} unit="건" /> },
              { key: 'exercise', label: '운동', badge: loaded.exercises.length > 0 && <Count n={loaded.exercises.length} unit="건" /> },
            ]}
          />

          <div role="tabpanel" hidden={tab !== 'meals'} className="flex flex-col gap-3">
            <Tabs
              label="끼니"
              variant="secondary"
              value={meal}
              onChange={(m) => updateParams({ meal: m })}
              items={MEALS.map((m) => {
                const logs = loaded.meals.filter((x) => x.meal === m.key)
                const badge = logs.length > 0 && (
                  <MealMark symptom={logs.some((x) => x.symptoms.length > 0)} count={m.key === 'snack' ? logs.length : undefined} />
                )
                return { key: m.key, label: m.label, badge }
              })}
            />
            {/* 탭을 옮겨도 입력 중인 내용이 사라지지 않도록 네 끼니 패널을 모두 두고 숨기기만 한다. */}
            {MEALS.map((m) => (
              <div key={`${date}-${m.key}`} role="tabpanel" hidden={meal !== m.key}>
                {m.key === 'snack' ? (
                  <SnackList
                    date={date}
                    snacks={loaded.meals.filter((x) => x.meal === 'snack')}
                    foodSuggestions={foods ?? []}
                    onChange={day.reload}
                  />
                ) : (
                  <MealCard
                    date={date}
                    meal={m.key}
                    label={m.label}
                    initial={loaded.meals.find((x) => x.meal === m.key)}
                    foodSuggestions={foods ?? []}
                    onSaved={day.reload}
                  />
                )}
              </div>
            ))}
          </div>

          <div role="tabpanel" hidden={tab !== 'exercise'}>
            <ExerciseList date={date} exercises={loaded.exercises} kinds={kinds ?? []} onChange={day.reload} />
          </div>
        </div>
      )}
    </section>
  )
}

function Count({ n, unit }: { n: number; unit: string }) {
  return (
    <span className="text-xs font-normal text-neutral-500">
      {n}
      {unit}
    </span>
  )
}

// 끼니 탭 표시: 기록 있음(점, 간식은 건수), 증상 있음(!)
function MealMark({ symptom, count }: { symptom: boolean; count?: number }) {
  if (count !== undefined && !symptom) return <span className="text-xs font-normal text-neutral-500">{count}</span>
  return symptom ? (
    <span className="text-xs font-bold" aria-label="증상 있음">
      !
    </span>
  ) : (
    <span className="size-1.5 rounded-full bg-current" aria-label="기록 있음" />
  )
}
