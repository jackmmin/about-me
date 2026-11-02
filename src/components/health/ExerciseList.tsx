import { useState } from 'react'
import { addExercise, deleteExercise, type ExerciseLog } from '../../lib/health.ts'
import { fieldClass, secondaryClass } from '../styles.ts'

// 그날의 운동 목록. 추가·삭제는 바로 저장된다.
export function ExerciseList({
  date,
  exercises,
  kinds,
  onChange,
}: {
  date: string
  exercises: ExerciseLog[]
  kinds: string[]
  onChange: () => void
}) {
  const [kind, setKind] = useState('')
  const [minutes, setMinutes] = useState('')
  const [intensity, setIntensity] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    try {
      await action()
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault()
    const m = Number(minutes)
    if (!kind.trim() || !(m > 0)) return setError('종류와 시간(분)을 입력하세요.')
    void run(async () => {
      await addExercise({ log_date: date, kind: kind.trim(), minutes: m, intensity: intensity ? Number(intensity) : null, memo: '' })
      setKind('')
      setMinutes('')
      setIntensity('')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {exercises.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {exercises.map((ex) => (
            <li key={ex.id} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
              <span className="font-semibold">{ex.kind}</span>
              <span className="text-neutral-500">
                {ex.minutes}분{ex.intensity ? ` · 강도 ${ex.intensity}` : ''}
              </span>
              <button
                type="button"
                className="ml-auto text-xs text-red-600 disabled:opacity-50"
                disabled={pending}
                onClick={() => void run(() => deleteExercise(ex.id))}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Enter로도 추가. 한글 입력 조합 중의 Enter는 무시한다. */}
      <div className="grid grid-cols-[1fr_5rem_5rem] gap-2" onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAdd(e)}>
        <input className={fieldClass} list="exercise-kinds" placeholder="운동 종류" value={kind} onChange={(e) => setKind(e.target.value)} />
        <input className={fieldClass} inputMode="numeric" placeholder="분" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
        <select className={fieldClass} value={intensity} onChange={(e) => setIntensity(e.target.value)} aria-label="강도">
          <option value="">강도</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <datalist id="exercise-kinds">
        {kinds.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="button" className={secondaryClass} disabled={pending} onClick={handleAdd}>
        운동 추가
      </button>
    </div>
  )
}
