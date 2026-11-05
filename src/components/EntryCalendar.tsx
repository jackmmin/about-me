import { useState } from 'react'
import { Link } from 'react-router'
import { listEntriesBetween } from '../lib/entries.ts'
import { formatDate, monthDays, today } from '../lib/format.ts'
import { coverThumbPath } from '../lib/images.ts'
import { EMOTION_INFO, listMoods, SCORE_INFO, type DailyMood } from '../lib/moods.ts'
import { ENTRY_TYPE_LABEL } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'
import { EntryCard } from './EntryCard.tsx'
import { primaryClass } from './styles.ts'
import { MonthGrid } from './MonthGrid.tsx'
import { MoodPicker } from './MoodPicker.tsx'

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
  const days = monthDays(month)
  const from = days[0]
  const to = days[days.length - 1]
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

  const now = today()
  const dayEntries = selected ? entries.filter((e) => e.record_date === selected) : []
  const thumbs = useSignedUrls(dayEntries.flatMap((e) => coverThumbPath(e) ?? []))

  return (
    <div className="flex flex-col gap-4">
      <MonthGrid
        month={month}
        selected={selected}
        loading={loading}
        error={error}
        onMonth={(m) => onNavigate(m, null)}
        onToday={() => onNavigate(now.slice(0, 7), now)}
        onSelect={(d) => onNavigate(month, d === selected ? null : d)}
        cellLabel={(d) => {
          const count = countByDate.get(d) ?? 0
          return `${formatDate(d)}${count ? `, ${ENTRY_TYPE_LABEL[type]} ${count}편` : ''}`
        }}
        renderCell={(d) => (
          <>
            <span className="mt-0.5 h-6 text-lg leading-6">{moodEmoji(moodOf(d))}</span>
            <span className="flex h-1.5 gap-0.5">
              {Array.from({ length: Math.min(countByDate.get(d) ?? 0, 3) }, (_, i) => (
                <span key={i} className="size-1.5 rounded-full bg-current opacity-60" />
              ))}
            </span>
          </>
        )}
      />

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
