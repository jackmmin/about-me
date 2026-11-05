import { useState } from 'react'
import { EMOTION_SETS, MOOD_KIND_LABEL, MOOD_SCORES, saveMood, type DailyMood, type MoodKind } from '../lib/moods.ts'

// 그날의 마음 기록: 점수 하나(다시 누르면 해제) + 감정 여러 개. 누를 때마다 바로 저장한다.
export function MoodPicker({
  kind,
  date,
  mood,
  onChange,
}: {
  kind: MoodKind
  date: string
  mood: DailyMood | null
  onChange: (mood: DailyMood | null) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const score = mood?.score ?? null
  const emotions = mood?.emotions ?? []
  const label = MOOD_KIND_LABEL[kind]

  async function save(next: DailyMood) {
    const previous = mood
    onChange(next.score === null && next.emotions.length === 0 ? null : next)
    setPending(true)
    setError(null)
    try {
      await saveMood(kind, next)
    } catch (e) {
      onChange(previous)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  function toggleEmotion(key: string) {
    const next = emotions.includes(key) ? emotions.filter((e) => e !== key) : [...emotions, key]
    void save({ mood_date: date, score, emotions: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-xs text-neutral-500">{label}</p>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
          {MOOD_SCORES.map((m) => {
            const on = score === m.score
            return (
              <button
                key={m.score}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={pending}
                className={`flex flex-col items-center rounded-xl border py-1.5 disabled:opacity-60 ${
                  on ? 'border-neutral-900 bg-neutral-100 dark:border-white dark:bg-neutral-800' : 'border-neutral-200 dark:border-neutral-800'
                }`}
                onClick={() => void save({ mood_date: date, score: on ? null : m.score, emotions })}
              >
                <span className="text-2xl leading-none">{m.emoji}</span>
                <span className="mt-1 text-xs text-neutral-500">{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-neutral-500">감정 (여러 개 선택)</p>
        <div className="flex flex-wrap gap-1.5">
          {EMOTION_SETS[kind].map((e) => {
            const on = emotions.includes(e.key)
            return (
              <button
                key={e.key}
                type="button"
                aria-pressed={on}
                disabled={pending}
                className={`rounded-full border px-2.5 py-1 text-sm disabled:opacity-60 ${
                  on
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}
                onClick={() => toggleEmotion(e.key)}
              >
                {e.emoji} {e.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">저장하지 못했습니다: {error}</p>}
    </div>
  )
}
