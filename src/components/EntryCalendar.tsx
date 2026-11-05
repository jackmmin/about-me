import { useState } from 'react'
import { Link } from 'react-router'
import { listEntriesBetween } from '../lib/entries.ts'
import { formatDate, formatMonth, today } from '../lib/format.ts'
import { shiftDate } from '../lib/health.ts'
import { coverThumbPath } from '../lib/images.ts'
import { EMOTION_INFO, listMoods, SCORE_INFO, type DailyMood } from '../lib/moods.ts'
import { ENTRY_TYPE_LABEL } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'
import { EntryCard } from './EntryCard.tsx'
import { primaryClass } from './styles.ts'
import { StatusMessage } from './ui.tsx'
import { MoodPicker } from './MoodPicker.tsx'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// month: YYYY-MM
function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 7)
}

// 달력 칸에 보일 이모티콘: 점수, 없으면 첫 감정
function moodEmoji(mood: DailyMood | null) {
  if (!mood) return null
  if (mood.score !== null) return SCORE_INFO[mood.score]?.emoji ?? null
  return mood.emotions[0] ? EMOTION_INFO[mood.emotions[0]].emoji : null
}

// 일기·묵상 월 달력: 날짜마다 마음 이모티콘과 기록 수(점). 날짜를 누르면 아래에서 마음 상태를 고르고 그날 기록을 본다.
// 부모가 key로 종류·달을 넘겨, 바뀌면 이 화면에서 고친 상태를 새로 시작한다.
export function EntryCalendar({
  type,
  month,
  selected,
  onNavigate,
}: {
  type: 'diary' | 'meditation'
  month: string
  selected: string | null
  onNavigate: (month: string, day: string | null) => void
}) {
  const from = `${month}-01`
  const to = shiftDate(`${shiftMonth(month, 1)}-01`, -1)
  const { data, error, loading } = useLoad(
    () => Promise.all([listEntriesBetween(type, from, to), listMoods(type, from, to)]),
    [type, month],
    `calendar:${type}:${month}`,
  )
  // 이 화면에서 고친 마음 기록 (불러온 값보다 우선)
  const [edited, setEdited] = useState<Record<string, DailyMood | null>>({})

  const entries = data?.[0] ?? []
  const moods = new Map((data?.[1] ?? []).map((m) => [m.mood_date, m]))
  const moodOf = (date: string) => (date in edited ? edited[date] : (moods.get(date) ?? null))
  const countByDate = new Map<string, number>()
  for (const e of entries) countByDate.set(e.record_date, (countByDate.get(e.record_date) ?? 0) + 1)

  const lead = new Date(`${from}T00:00:00Z`).getUTCDay()
  const days = Array.from({ length: Number(to.slice(8)) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  const now = today()

  const dayEntries = selected ? entries.filter((e) => e.record_date === selected) : []
  const thumbs = useSignedUrls(dayEntries.flatMap((e) => coverThumbPath(e) ?? []))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-lg"
          aria-label="이전 달"
          onClick={() => onNavigate(shiftMonth(month, -1), null)}
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{formatMonth(from)}</h2>
          {month !== now.slice(0, 7) && (
            <button
              type="button"
              className="text-xs text-neutral-500 underline-offset-4 hover:underline"
              onClick={() => onNavigate(now.slice(0, 7), now)}
            >
              오늘
            </button>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-lg"
          aria-label="다음 달"
          onClick={() => onNavigate(shiftMonth(month, 1), null)}
        >
          ›
        </button>
      </div>

      {error ? (
        <StatusMessage error={error} />
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center" aria-busy={loading}>
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={`pb-1 text-xs ${i === 0 ? 'text-red-500' : 'text-neutral-500'}`}>
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {days.map((d) => {
            const emoji = moodEmoji(moodOf(d))
            const count = countByDate.get(d) ?? 0
            const isSelected = d === selected
            return (
              <button
                key={d}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${formatDate(d)}${count ? `, ${ENTRY_TYPE_LABEL[type]} ${count}편` : ''}`}
                className={`flex aspect-square flex-col items-center justify-start rounded-lg pt-1 text-xs ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
                } ${d === now && !isSelected ? 'ring-1 ring-neutral-400' : ''} ${d > now ? 'opacity-50' : ''}`}
                onClick={() => onNavigate(month, isSelected ? null : d)}
              >
                <span>{Number(d.slice(8))}</span>
                <span className="mt-0.5 h-6 text-lg leading-6">{emoji}</span>
                <span className="flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <span key={i} className="size-1.5 rounded-full bg-current opacity-60" />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{formatDate(selected)}</h3>
            <Link to={`/entries/new?type=${type}&date=${selected}`} className={primaryClass}>
              이 날 {ENTRY_TYPE_LABEL[type]} 쓰기
            </Link>
          </div>
          <MoodPicker kind={type} date={selected} mood={moodOf(selected)} onChange={(m) => setEdited((prev) => ({ ...prev, [selected]: m }))} />
          {dayEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              {dayEntries.map((e) => (
                <EntryCard key={e.id} entry={e} hideDate thumbUrl={thumbs[coverThumbPath(e) ?? '']} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
