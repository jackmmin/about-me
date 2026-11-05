import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CategoryBars, ChartCard, DailyBarChart, TrendLineChart, type CategoryRow, type ChartRow, type SeriesDef } from '../components/charts.tsx'
import { fieldClass } from '../components/styles.ts'
import { PageHeader, StatusMessage, TagChip } from '../components/ui.tsx'
import { BIBLE_BOOKS, getBook } from '../lib/bible.ts'
import { listEntriesBetween } from '../lib/entries.ts'
import { formatDate, shortDate, today } from '../lib/format.ts'
import { dateRange, shiftDate } from '../lib/health.ts'
import { EMOTION_INFO, EMOTION_SETS, listMoods, MOOD_KIND_LABEL, MOOD_SCORES, SCORE_INFO, type DailyMood } from '../lib/moods.ts'
import { ENTRY_TYPE_LABEL, ENTRY_TYPE_PATH, type Entry } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'

type StatsType = 'diary' | 'meditation'
type Preset = 7 | 30 | 90 | 365 | 'custom'
type Unit = 'day' | 'week' | 'month'
type Testament = 'old' | 'new'

const PRESETS: { key: Preset; label: string; unit: Unit }[] = [
  { key: 7, label: '1주', unit: 'day' },
  { key: 30, label: '1개월', unit: 'day' },
  { key: 90, label: '3개월', unit: 'week' },
  { key: 365, label: '1년', unit: 'month' },
  { key: 'custom', label: '직접 지정', unit: 'week' },
]

const UNITS: { key: Unit; label: string }[] = [
  { key: 'day', label: '일별' },
  { key: 'week', label: '주별' },
  { key: 'month', label: '월별' },
]

const TESTAMENTS: { key: Testament; label: string }[] = [
  { key: 'old', label: '구약' },
  { key: 'new', label: '신약' },
]

const BOOK_ORDER = new Map(BIBLE_BOOKS.map((b, i) => [b.id, i]))
const scoreText = (v: number) => `${SCORE_INFO[Math.round(v)]?.emoji ?? ''} ${v.toFixed(1)}`
const days = (v: number) => `${v}일`

// 하루 단위로 모은 기록과 마음 상태. books·testaments는 묵상 말씀에서 모은다.
interface Day {
  date: string
  score: number | null
  emotions: string[]
  tags: Set<string>
  books: Set<string>
  testaments: Set<Testament>
  entries: number
}

function buildDays(dates: string[], entries: Entry[], moods: DailyMood[]): Day[] {
  const byDate = new Map<string, Day>(
    dates.map((date) => [date, { date, score: null, emotions: [], tags: new Set(), books: new Set(), testaments: new Set(), entries: 0 }]),
  )
  for (const e of entries) {
    const d = byDate.get(e.record_date)
    if (!d) continue
    d.entries++
    for (const t of e.tags) d.tags.add(t)
    for (const p of e.passages) {
      const book = getBook(p.book)
      if (!book) continue
      d.books.add(book.id)
      d.testaments.add(book.testament)
    }
  }
  for (const m of moods) {
    const d = byDate.get(m.mood_date)
    if (!d) continue
    d.score = m.score
    d.emotions = m.emotions
  }
  return [...byDate.values()].filter((d) => d.entries > 0 || d.score !== null || d.emotions.length > 0)
}

// 묶음 단위의 대표 날짜: 일별은 그날, 주별은 그 주 월요일, 월별은 1일
function bucketOf(date: string, unit: Unit) {
  if (unit === 'day') return date
  if (unit === 'month') return `${date.slice(0, 7)}-01`
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return shiftDate(date, -((weekday + 6) % 7))
}

const UNIT_FORMAT: Record<Unit, { tick: (d: string) => string; label: (d: string) => string }> = {
  day: { tick: shortDate, label: formatDate },
  week: { tick: shortDate, label: (d) => `${shortDate(d)} 주` },
  month: { tick: (d) => `${Number(d.slice(5, 7))}월`, label: (d) => `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월` },
}

function buildTrend(start: string, end: string, unit: Unit, filtered: Day[]): ChartRow[] {
  const buckets = [...new Set(dateRange(start, end).map((d) => bucketOf(d, unit)))]
  const groups = new Map<string, Day[]>()
  for (const d of filtered) {
    const key = bucketOf(d.date, unit)
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  return buckets.map((date) => {
    const group = groups.get(date) ?? []
    const entries = group.reduce((n, d) => n + d.entries, 0)
    return { date, avg_score: averageScore(group), entries: entries || null }
  })
}

function averageScore(ds: Day[]) {
  const scores = ds.flatMap((d) => (d.score !== null ? [d.score] : []))
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}

// 날마다 붙은 항목(태그·책)별로: 그 항목이 있는 날 수와 그날들의 평균 점수. 많은 순.
function groupRows(filtered: Day[], keysOf: (d: Day) => Iterable<string>, labelOf: (key: string) => string, limit = 15): CategoryRow[] {
  const groups = new Map<string, Day[]>()
  for (const d of filtered) for (const k of keysOf(d)) groups.set(k, [...(groups.get(k) ?? []), d])
  return [...groups]
    .map(([key, ds]) => {
      const avg = averageScore(ds)
      return { label: labelOf(key), value: ds.length, note: avg !== null ? `평균 ${scoreText(avg)}` : undefined }
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`rounded-full px-3 py-1 text-sm ${
        on ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function FilterGroup({ label, extra, children }: { label: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-xs text-neutral-500">{label}</p>
        {extra}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

// 일기·묵상 통계: /diary/stats, /meditation/stats. 묵상에는 말씀(구약·신약, 책) 필터와 그래프가 더해진다.
export function EntryStatsPage({ type }: { type: StatsType }) {
  const [preset, setPreset] = useState<Preset>(30)
  const [customFrom, setCustomFrom] = useState(shiftDate(today(), -29))
  const [customTo, setCustomTo] = useState(today())
  const [unit, setUnit] = useState<Unit>('day')
  const [tags, setTags] = useState<string[]>([])
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any')
  const [scores, setScores] = useState<number[]>([])
  const [emotions, setEmotions] = useState<string[]>([])
  const [testaments, setTestaments] = useState<Testament[]>([])
  const [books, setBooks] = useState<string[]>([])
  const [showTable, setShowTable] = useState(false)

  const isMeditation = type === 'meditation'
  const entryLabel = ENTRY_TYPE_LABEL[type]
  const moodLabel = MOOD_KIND_LABEL[type]
  const scoreSeries: SeriesDef = { key: 'avg_score', name: `평균 ${moodLabel}`, format: scoreText }
  const entrySeries: SeriesDef = { key: 'entries', name: entryLabel, format: (v) => `${Math.round(v)}편` }

  const end = preset === 'custom' ? customTo : today()
  const start = preset === 'custom' ? customFrom : shiftDate(end, -(preset - 1))
  const validRange = start <= end
  const { data, error, loading } = useLoad(
    () => (validRange ? Promise.all([listEntriesBetween(type, start, end), listMoods(type, start, end)]) : Promise.resolve(null)),
    [type, start, end],
    `stats:${type}:${start}:${end}`,
  )

  const all = data ? buildDays(dateRange(start, end), data[0], data[1]) : []
  const availableTags = [...new Set([...all.flatMap((d) => [...d.tags]), ...tags])].sort()
  const availableBooks = [...new Set([...all.flatMap((d) => [...d.books]), ...books])].sort(
    (a, b) => (BOOK_ORDER.get(a) ?? 0) - (BOOK_ORDER.get(b) ?? 0),
  )
  const filtered = all.filter(
    (d) =>
      (tags.length === 0 || (tagMode === 'any' ? tags.some((t) => d.tags.has(t)) : tags.every((t) => d.tags.has(t)))) &&
      (scores.length === 0 || (d.score !== null && scores.includes(d.score))) &&
      (emotions.length === 0 || emotions.some((e) => d.emotions.includes(e))) &&
      (testaments.length === 0 || testaments.some((t) => d.testaments.has(t))) &&
      (books.length === 0 || books.some((b) => d.books.has(b))),
  )
  const filterCount = tags.length + scores.length + emotions.length + testaments.length + books.length

  const avgScore = averageScore(filtered)
  const entryTotal = filtered.reduce((n, d) => n + d.entries, 0)

  const emotionRows = EMOTION_SETS[type]
    .map((e) => ({ label: `${e.emoji} ${e.label}`, value: filtered.filter((d) => d.emotions.includes(e.key)).length }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const scoreRows = MOOD_SCORES.map((m) => ({ label: `${m.emoji} ${m.label}`, value: filtered.filter((d) => d.score === m.score).length }))
  const tagRows = groupRows(filtered, (d) => d.tags, (t) => `#${t}`)
  const bookRows = groupRows(filtered, (d) => d.books, (id) => getBook(id)?.name ?? id)
  const testamentRows = TESTAMENTS.map((t) => ({ label: t.label, value: filtered.filter((d) => d.testaments.has(t.key)).length }))

  const trend = buildTrend(start, end, unit, filtered)
  const fmt = UNIT_FORMAT[unit]

  function resetFilters() {
    setTags([])
    setScores([])
    setEmotions([])
    setTestaments([])
    setBooks([])
  }

  return (
    <section>
      <PageHeader
        title={`${entryLabel} 통계`}
        description={isMeditation ? `${moodLabel}·감정·말씀·태그` : `${moodLabel}·감정·태그`}
        actions={
          <Link to={ENTRY_TYPE_PATH[type]} className="text-sm text-neutral-500">
            ← {entryLabel}
          </Link>
        }
      />

      {/* 필터: 기간 → 묶음 단위 → 조건 */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="기간">
          {PRESETS.map((p) => (
            <Pill
              key={p.key}
              on={preset === p.key}
              onClick={() => {
                setPreset(p.key)
                setUnit(p.unit)
              }}
            >
              {p.label}
            </Pill>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className={fieldClass} value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} aria-label="시작일" />
            <span className="text-neutral-500">~</span>
            <input type="date" className={fieldClass} value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} aria-label="종료일" />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="묶음 단위">
          {UNITS.map((u) => (
            <Pill key={u.key} on={unit === u.key} onClick={() => setUnit(u.key)}>
              {u.label}
            </Pill>
          ))}
        </div>

        <details className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800" open={filterCount > 0 || undefined}>
          <summary className="cursor-pointer text-sm font-semibold">
            조건 필터{filterCount > 0 && <span className="ml-1.5 font-normal text-neutral-500">{filterCount}개 적용</span>}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <FilterGroup label={moodLabel}>
              {MOOD_SCORES.map((m) => (
                <Pill key={m.score} on={scores.includes(m.score)} onClick={() => setScores(toggle(scores, m.score))}>
                  {m.emoji} {m.label}
                </Pill>
              ))}
            </FilterGroup>
            <FilterGroup label="감정 (하나라도 있는 날)">
              {EMOTION_SETS[type].map((e) => (
                <Pill key={e.key} on={emotions.includes(e.key)} onClick={() => setEmotions(toggle(emotions, e.key))}>
                  {e.emoji} {e.label}
                </Pill>
              ))}
            </FilterGroup>
            {isMeditation && (
              <>
                <FilterGroup label="구약·신약">
                  {TESTAMENTS.map((t) => (
                    <Pill key={t.key} on={testaments.includes(t.key)} onClick={() => setTestaments(toggle(testaments, t.key))}>
                      {t.label}
                    </Pill>
                  ))}
                </FilterGroup>
                <FilterGroup label="성경 (하나라도 묵상한 날)">
                  {availableBooks.length === 0 ? (
                    <p className="text-sm text-neutral-400">이 기간 묵상에 말씀이 없습니다.</p>
                  ) : (
                    availableBooks.map((id) => (
                      <Pill key={id} on={books.includes(id)} onClick={() => setBooks(toggle(books, id))}>
                        {getBook(id)?.name ?? id}
                      </Pill>
                    ))
                  )}
                </FilterGroup>
              </>
            )}
            <FilterGroup
              label="태그"
              extra={
                tags.length > 1 && (
                  <div className="flex gap-1 text-xs" role="radiogroup" aria-label="태그 조건">
                    {(['any', 'all'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={tagMode === m}
                        className={tagMode === m ? 'font-semibold underline underline-offset-4' : 'text-neutral-500'}
                        onClick={() => setTagMode(m)}
                      >
                        {m === 'any' ? '하나라도 포함' : '모두 포함'}
                      </button>
                    ))}
                  </div>
                )
              }
            >
              {availableTags.length === 0 ? (
                <p className="text-sm text-neutral-400">이 기간 {entryLabel}에 태그가 없습니다.</p>
              ) : (
                availableTags.map((t) => <TagChip key={t} name={t} active={tags.includes(t)} onClick={() => setTags(toggle(tags, t))} />)
              )}
            </FilterGroup>
            {filterCount > 0 && (
              <button type="button" className="self-start text-sm text-neutral-500 underline-offset-4 hover:underline" onClick={resetFilters}>
                조건 초기화
              </button>
            )}
          </div>
        </details>
      </div>

      {!validRange ? (
        <StatusMessage error="시작일이 종료일보다 늦습니다." />
      ) : filtered.length === 0 ? (
        <StatusMessage
          loading={loading}
          error={error}
          empty={filterCount > 0 ? '조건에 맞는 날이 없습니다.' : '이 기간에 기록이 없습니다.'}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="기록한 날" value={days(filtered.length)} />
            <Tile label={`평균 ${moodLabel}`} value={avgScore !== null ? scoreText(avgScore) : '-'} />
            <Tile label={entryLabel} value={entrySeries.format(entryTotal)} />
            <Tile label="가장 많은 감정" value={emotionRows[0]?.label ?? '-'} />
          </div>

          <ChartCard title={`${moodLabel} 추이`}>
            {avgScore === null ? (
              <p className="py-6 text-center text-sm text-neutral-400">{moodLabel} 기록이 없습니다.</p>
            ) : (
              <TrendLineChart
                data={trend}
                series={scoreSeries}
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                yTickFormat={(v) => SCORE_INFO[v]?.emoji ?? ''}
                tickFormat={fmt.tick}
                labelFormat={fmt.label}
              />
            )}
          </ChartCard>

          <ChartCard title={`${moodLabel} 분포`}>
            <CategoryBars rows={scoreRows} format={days} />
          </ChartCard>

          {emotionRows.length > 0 && (
            <ChartCard title="감정">
              <CategoryBars rows={emotionRows} format={days} />
            </ChartCard>
          )}

          {isMeditation && bookRows.length > 0 && (
            <>
              <ChartCard title="구약·신약">
                <CategoryBars rows={testamentRows} format={days} />
              </ChartCard>
              <ChartCard title={`성경별 묵상한 날 · 평균 ${moodLabel}`}>
                <CategoryBars rows={bookRows} format={days} />
              </ChartCard>
            </>
          )}

          {tagRows.length > 0 && (
            <ChartCard title={`태그별 기록한 날 · 평균 ${moodLabel}`}>
              <CategoryBars rows={tagRows} format={days} />
            </ChartCard>
          )}

          <ChartCard title={`${entryLabel} 수`}>
            <DailyBarChart data={trend} series={entrySeries} tickFormat={fmt.tick} labelFormat={fmt.label} />
          </ChartCard>

          <button className="text-sm text-neutral-500 underline-offset-4 hover:underline" onClick={() => setShowTable(!showTable)}>
            {showTable ? '표 닫기' : '표로 보기'}
          </button>
          {showTable && <DayTable days={filtered} moodLabel={moodLabel} entryLabel={entryLabel} showBooks={isMeditation} />}
        </div>
      )}
    </section>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  )
}

function DayTable({ days, moodLabel, entryLabel, showBooks }: { days: Day[]; moodLabel: string; entryLabel: string; showBooks: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-left text-xs">
        <thead className="text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="p-2 font-normal">날짜</th>
            <th className="p-2 font-normal">{moodLabel}</th>
            <th className="p-2 font-normal">감정</th>
            {showBooks && <th className="p-2 font-normal">말씀</th>}
            <th className="p-2 font-normal">태그</th>
            <th className="p-2 text-right font-normal">{entryLabel}</th>
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.date} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
              <td className="whitespace-nowrap p-2 tabular-nums">{d.date.slice(5)}</td>
              <td className="whitespace-nowrap p-2">{d.score !== null ? `${SCORE_INFO[d.score].emoji} ${SCORE_INFO[d.score].label}` : '-'}</td>
              <td className="p-2">{d.emotions.map((e) => EMOTION_INFO[e]?.emoji ?? '').join(' ') || '-'}</td>
              {showBooks && <td className="p-2">{[...d.books].map((id) => getBook(id)?.short ?? id).join(', ') || '-'}</td>}
              <td className="p-2">{[...d.tags].map((t) => `#${t}`).join(' ') || '-'}</td>
              <td className="p-2 text-right tabular-nums">{d.entries || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
