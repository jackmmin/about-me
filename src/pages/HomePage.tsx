import { useState } from 'react'
import { Link } from 'react-router'
import { EntryCard } from '../components/EntryCard.tsx'
import { primaryClass, secondaryClass } from '../components/styles.ts'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { listEntries } from '../lib/entries.ts'
import { formatDate, today } from '../lib/format.ts'
import { listHealthRange, MEALS, shiftDate, type ExerciseLog, type MealLog } from '../lib/health.ts'
import { thumbPath } from '../lib/images.ts'
import type { Entry, EntryType } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'

const PAGE_DAYS = 14

type Filter = 'all' | EntryType | 'health'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'diary', label: '일기' },
  { key: 'photo', label: '사진' },
  { key: 'meditation', label: '묵상' },
  { key: 'health', label: '건강' },
]

interface Day {
  date: string
  entries: Entry[]
  meals: MealLog[]
  exercises: ExerciseLog[]
}

// 일기·사진·묵상과 그날의 건강 기록을 날짜별로 묶는다. (최신 날짜부터)
function groupByDate(entries: Entry[], meals: MealLog[], exercises: ExerciseLog[]) {
  const days = new Map<string, Day>()
  const day = (date: string) => {
    let d = days.get(date)
    if (!d) days.set(date, (d = { date, entries: [], meals: [], exercises: [] }))
    return d
  }
  for (const e of entries) day(e.record_date).entries.push(e)
  for (const m of meals) day(m.log_date).meals.push(m)
  for (const ex of exercises) day(ex.log_date).exercises.push(ex)
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}

// 홈: 최근 기록 전체를 날짜별 타임라인으로 (14일씩 더 불러온다)
export function HomePage() {
  const [days, setDays] = useState(PAGE_DAYS)
  const [filter, setFilter] = useState<Filter>('all')
  const from = shiftDate(today(), -(days - 1))
  const { data, error, loading } = useLoad(async () => {
    const [entries, health] = await Promise.all([listEntries({ from, limit: 1000 }), listHealthRange(from, today())])
    return { entries, ...health }
  }, [from])

  const showHealth = filter === 'all' || filter === 'health'
  const timeline = groupByDate(
    (data?.entries ?? []).filter((e) => filter === 'all' || filter === e.type),
    showHealth ? (data?.meals ?? []) : [],
    showHealth ? (data?.exercises ?? []) : [],
  )
  const thumbs = useSignedUrls(
    timeline.flatMap((d) => d.entries.flatMap((e) => (e.images[0] ? [thumbPath(e.images[0].storage_path)] : []))),
  )

  return (
    <section>
      <PageHeader
        title="홈"
        description="최근 기록"
        actions={
          <>
            <Link to="/entries/new?type=diary" className={primaryClass}>
              새 일기
            </Link>
            <Link to="/entries/new?type=photo" className={secondaryClass}>
              새 앨범
            </Link>
            <Link to="/entries/new?type=meditation" className={secondaryClass}>
              새 묵상
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="유형">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="radio"
            aria-checked={filter === f.key}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.key ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {timeline.length === 0 ? (
        <StatusMessage loading={loading && !data} error={error} empty={`최근 ${days}일 동안 기록이 없습니다.`} />
      ) : (
        <div className="flex flex-col gap-6">
          {timeline.map((d) => (
            <div key={d.date}>
              <h2 className="mb-2 text-sm font-semibold text-neutral-500">{formatDate(d.date)}</h2>
              <div className="flex flex-col gap-3">
                {d.entries.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    showType
                    hideDate
                    thumbUrl={e.images[0] && thumbs[thumbPath(e.images[0].storage_path)]}
                  />
                ))}
                {(d.meals.length > 0 || d.exercises.length > 0) && <HealthCard date={d.date} meals={d.meals} exercises={d.exercises} />}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={`${secondaryClass} mt-6 w-full`} disabled={loading} onClick={() => setDays(days + PAGE_DAYS)}>
        {loading && data ? '불러오는 중…' : `이전 ${PAGE_DAYS}일 더 보기`}
      </button>
    </section>
  )
}

// 그날 건강 기록 요약: 건수·증상·운동 시간 + 끼니별 음식, 운동 목록
function HealthCard({ date, meals, exercises }: { date: string; meals: MealLog[]; exercises: ExerciseLog[] }) {
  const symptomCount = meals.filter((m) => m.symptoms.length > 0).length
  const exerciseMinutes = exercises.reduce((sum, ex) => sum + ex.minutes, 0)
  const summary = [
    meals.length > 0 && `식단 ${meals.length}건`,
    symptomCount > 0 && `증상 ${symptomCount}건`,
    exercises.length > 0 && `운동 ${exerciseMinutes}분`,
  ].filter(Boolean)

  // 아침·점심·저녁·간식 순서, 간식은 여러 건이면 번호를 붙인다.
  const snackCount = meals.filter((m) => m.meal === 'snack').length
  const mealLines = MEALS.flatMap((def) =>
    meals
      .filter((m) => m.meal === def.key)
      .map((m, i) => ({
        key: m.id,
        label: def.key === 'snack' && snackCount > 1 ? `${def.label} ${i + 1}` : def.label,
        text: m.foods.join(', ') || m.note || '-',
        symptom: m.symptoms.length > 0,
      })),
  )

  return (
    <Link
      to={`/health?date=${date}`}
      className="block rounded-xl border border-neutral-200 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <p className="text-xs text-neutral-500">
        <span className="mr-1.5 font-semibold">건강</span>
        {summary.join(' · ')}
      </p>
      <ul className="mt-2 flex flex-col gap-0.5 text-sm">
        {mealLines.map((l) => (
          <li key={l.key} className="flex gap-2">
            <span className="w-12 shrink-0 text-neutral-500">{l.label}</span>
            <span className="min-w-0 truncate">{l.text}</span>
            {l.symptom && <span className="shrink-0 text-xs font-bold text-red-600 dark:text-red-400">증상</span>}
          </li>
        ))}
        {exercises.length > 0 && (
          <li className="flex gap-2">
            <span className="w-12 shrink-0 text-neutral-500">운동</span>
            <span className="min-w-0 truncate">{exercises.map((ex) => `${ex.kind} ${ex.minutes}분`).join(', ')}</span>
          </li>
        )}
      </ul>
    </Link>
  )
}
