import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CategoryBars, ChartCard, DailyBarChart, TrendLineChart, type ChartRow, type SeriesDef } from '../components/charts.tsx'
import { fieldClass } from '../components/styles.ts'
import { PageHeader, StatusMessage, TagChip } from '../components/ui.tsx'
import { listEntriesBetween } from '../lib/entries.ts'
import { formatDate, shortDate, today } from '../lib/format.ts'
import { dateRange, shiftDate } from '../lib/health.ts'
import { EMOTION_INFO, EMOTIONS, listMoods, MOOD_SCORES, SCORE_INFO, type DailyMood, type EmotionKey } from '../lib/moods.ts'
import type { Entry } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'

type Preset = 7 | 30 | 90 | 365 | 'custom'
type Unit = 'day' | 'week' | 'month'

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

const SCORE: SeriesDef = { key: 'avg_score', name: '평균 컨디션', format: (v) => `${SCORE_INFO[Math.round(v)]?.emoji ?? ''} ${v.toFixed(1)}` }
const ENTRIES: SeriesDef = { key: 'entries', name: '일기', format: (v) => `${Math.round(v)}편` }
const days = (v: number) => `${v}일`

// 하루 단위로 모은 일기·컨디션
interface Day {
  date: string
  score: number | null
  emotions: EmotionKey[]
  tags: Set<string>
  entries: number
}

function buildDays(dates: string[], entries: Entry[], moods: DailyMood[]): Day[] {
  const byDate = new Map<string, Day>(dates.map((date) => [date, { date, score: null, emotions: [], tags: new Set(), entries: 0 }]))
  for (const e of entries) {
    const d = byDate.get(e.record_date)
    if (!d) continue
    d.entries++
    for (const t of e.tags) d.tags.add(t)
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
    const scores = group.flatMap((d) => (d.score !== null ? [d.score] : []))
    const entries = group.reduce((n, d) => n + d.entries, 0)
    return { date, avg_score: average(scores), entries: entries || null }
  })
}

function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
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

export function DiaryStatsPage() {
  const [preset, setPreset] = useState<Preset>(30)
  const [customFrom, setCustomFrom] = useState(shiftDate(today(), -29))
  const [customTo, setCustomTo] = useState(today())
  const [unit, setUnit] = useState<Unit>('day')
  const [tags, setTags] = useState<string[]>([])
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any')
  const [scores, setScores] = useState<number[]>([])
  const [emotions, setEmotions] = useState<EmotionKey[]>([])
  const [showTable, setShowTable] = useState(false)

  const end = preset === 'custom' ? customTo : today()
  const start = preset === 'custom' ? customFrom : shiftDate(end, -(preset - 1))
  const validRange = start <= end
  const { data, error, loading } = useLoad(
    () => (validRange ? Promise.all([listEntriesBetween('diary', start, end), listMoods(start, end)]) : Promise.resolve(null)),
    [start, end],
    `diary-stats:${start}:${end}`,
  )

  const all = data ? buildDays(dateRange(start, end), data[0], data[1]) : []
  const availableTags = [...new Set([...all.flatMap((d) => [...d.tags]), ...tags])].sort()
  const filtered = all.filter(
    (d) =>
      (tags.length === 0 || (tagMode === 'any' ? tags.some((t) => d.tags.has(t)) : tags.every((t) => d.tags.has(t)))) &&
      (scores.length === 0 || (d.score !== null && scores.includes(d.score))) &&
      (emotions.length === 0 || emotions.some((e) => d.emotions.includes(e))),
  )
  const filterCount = tags.length + scores.length + emotions.length

  const scored = filtered.flatMap((d) => (d.score !== null ? [d.score] : []))
  const avgScore = average(scored)
  const entryTotal = filtered.reduce((n, d) => n + d.entries, 0)

  const emotionRows = EMOTIONS.map((e) => ({ label: `${e.emoji} ${e.label}`, value: filtered.filter((d) => d.emotions.includes(e.key)).length }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const scoreRows = MOOD_SCORES.map((m) => ({ label: `${m.emoji} ${m.label}`, value: filtered.filter((d) => d.score === m.score).length }))

  // 태그별: 그 태그가 붙은 날 수와 그날들의 평균 컨디션
  const tagStats = new Map<string, Day[]>()
  for (const d of filtered) for (const t of d.tags) tagStats.set(t, [...(tagStats.get(t) ?? []), d])
  const tagRows = [...tagStats]
    .map(([tag, ds]) => {
      const avg = average(ds.flatMap((d) => (d.score !== null ? [d.score] : [])))
      return { label: `#${tag}`, value: ds.length, note: avg !== null ? `평균 ${SCORE.format(avg)}` : undefined }
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 15)

  const trend = buildTrend(start, end, unit, filtered)
  const fmt = UNIT_FORMAT[unit]

  return (
    <section>
      <PageHeader
        title="일기 통계"
        description="컨디션·감정·태그"
        actions={
          <Link to="/diary" className="text-sm text-neutral-500">
            ← 일기
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
            <div>
              <p className="mb-1.5 text-xs text-neutral-500">컨디션</p>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_SCORES.map((m) => (
                  <Pill key={m.score} on={scores.includes(m.score)} onClick={() => setScores(toggle(scores, m.score))}>
                    {m.emoji} {m.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-neutral-500">감정 (하나라도 있는 날)</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map((e) => (
                  <Pill key={e.key} on={emotions.includes(e.key)} onClick={() => setEmotions(toggle(emotions, e.key))}>
                    {e.emoji} {e.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <p className="text-xs text-neutral-500">태그</p>
                {tags.length > 1 && (
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
                )}
              </div>
              {availableTags.length === 0 ? (
                <p className="text-sm text-neutral-400">이 기간 일기에 태그가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((t) => (
                    <TagChip key={t} name={t} active={tags.includes(t)} onClick={() => setTags(toggle(tags, t))} />
                  ))}
                </div>
              )}
            </div>
            {filterCount > 0 && (
              <button
                type="button"
                className="self-start text-sm text-neutral-500 underline-offset-4 hover:underline"
                onClick={() => {
                  setTags([])
                  setScores([])
                  setEmotions([])
                }}
              >
                조건 초기화
              </button>
            )}
          </div>
        </details>
      </div>

      {!validRange ? (
        <StatusMessage error="시작일이 종료일보다 늦습니다." />
      ) : filtered.length === 0 ? (
        <StatusMessage loading={loading} error={error} empty={filterCount > 0 ? '조건에 맞는 날이 없습니다.' : '이 기간에 일기나 컨디션 기록이 없습니다.'} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="기록한 날" value={days(filtered.length)} />
            <Tile label="평균 컨디션" value={avgScore !== null ? SCORE.format(avgScore) : '-'} />
            <Tile label="일기" value={ENTRIES.format(entryTotal)} />
            <Tile label="가장 많은 감정" value={emotionRows[0]?.label ?? '-'} />
          </div>

          <ChartCard title="컨디션 추이">
            {scored.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">컨디션을 지정한 날이 없습니다.</p>
            ) : (
              <TrendLineChart
                data={trend}
                series={SCORE}
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                yTickFormat={(v) => SCORE_INFO[v]?.emoji ?? ''}
                tickFormat={fmt.tick}
                labelFormat={fmt.label}
              />
            )}
          </ChartCard>

          <ChartCard title="컨디션 분포">
            <CategoryBars rows={scoreRows} format={days} />
          </ChartCard>

          {emotionRows.length > 0 && (
            <ChartCard title="감정">
              <CategoryBars rows={emotionRows} format={days} />
            </ChartCard>
          )}

          {tagRows.length > 0 && (
            <ChartCard title="태그별 기록한 날 · 평균 컨디션">
              <CategoryBars rows={tagRows} format={days} />
            </ChartCard>
          )}

          <ChartCard title="일기 수">
            <DailyBarChart data={trend} series={ENTRIES} tickFormat={fmt.tick} labelFormat={fmt.label} />
          </ChartCard>

          <button className="text-sm text-neutral-500 underline-offset-4 hover:underline" onClick={() => setShowTable(!showTable)}>
            {showTable ? '표 닫기' : '표로 보기'}
          </button>
          {showTable && <DayTable days={filtered} />}
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

function DayTable({ days }: { days: Day[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-left text-xs">
        <thead className="text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="p-2 font-normal">날짜</th>
            <th className="p-2 font-normal">컨디션</th>
            <th className="p-2 font-normal">감정</th>
            <th className="p-2 font-normal">태그</th>
            <th className="p-2 text-right font-normal">일기</th>
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.date} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
              <td className="whitespace-nowrap p-2 tabular-nums">{d.date.slice(5)}</td>
              <td className="whitespace-nowrap p-2">{d.score !== null ? `${SCORE_INFO[d.score].emoji} ${SCORE_INFO[d.score].label}` : '-'}</td>
              <td className="p-2">{d.emotions.map((e) => EMOTION_INFO[e].emoji).join(' ') || '-'}</td>
              <td className="p-2">{[...d.tags].map((t) => `#${t}`).join(' ') || '-'}</td>
              <td className="p-2 text-right tabular-nums">{d.entries || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
