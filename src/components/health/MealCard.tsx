import { useState } from 'react'
import { SEVERITY_LABEL, SYMPTOMS, saveMeal, type MealKey, type MealLog, type SymptomKey } from '../../lib/health.ts'
import { fieldClass, secondaryClass } from '../styles.ts'
import { TagInput } from '../TagInput.tsx'

// 끼니 하나: 먹은 음식, 식후 증상(체크 + 정도), 메모. 끼니별로 따로 저장한다.
export function MealCard({
  date,
  meal,
  label,
  initial,
  foodSuggestions,
  onSaved,
}: {
  date: string
  meal: MealKey
  label: string
  initial: MealLog | undefined
  foodSuggestions: string[]
  onSaved: () => void
}) {
  const [foods, setFoods] = useState(initial?.foods ?? [])
  const [symptoms, setSymptoms] = useState<SymptomKey[]>(initial?.symptoms ?? [])
  const [severity, setSeverity] = useState<number | null>(initial?.severity ?? null)
  const [note, setNote] = useState(initial?.note ?? '')
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<{ pending?: boolean; message?: string; error?: boolean }>({})

  const touch = () => {
    setDirty(true)
    setStatus({})
  }

  function toggleSymptom(key: SymptomKey) {
    const next = symptoms.includes(key) ? symptoms.filter((s) => s !== key) : [...symptoms, key]
    setSymptoms(next)
    if (next.length === 0) setSeverity(null)
    touch()
  }

  async function save() {
    setStatus({ pending: true })
    try {
      await saveMeal({ log_date: date, meal, foods, symptoms, severity: symptoms.length ? severity : null, note: note.trim() })
      setDirty(false)
      setStatus({ message: '저장했습니다.' })
      onSaved()
    } catch (e) {
      setStatus({ error: true, message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex flex-col gap-3">
        <TagInput
          value={foods}
          onChange={(v) => {
            setFoods(v)
            touch()
          }}
          suggestions={foodSuggestions}
          prefix=""
          itemLabel="음식"
          placeholder="먹은 음식 입력 후 Enter (예: 우유)"
        />

        <div>
          <p className="mb-1.5 text-xs text-neutral-500">식후 증상</p>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => {
              const on = symptoms.includes(s.key)
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    on
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                  onClick={() => toggleSymptom(s.key)}
                >
                  {on && '✓ '}
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {symptoms.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-neutral-500">정도</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="증상 정도">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={severity === n}
                  className={`w-12 rounded-lg border py-1 text-sm ${
                    severity === n
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                  onClick={() => {
                    setSeverity(severity === n ? null : n)
                    touch()
                  }}
                >
                  {SEVERITY_LABEL[n]}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          rows={2}
          className={`${fieldClass} resize-y text-sm`}
          placeholder="메모 (예: 먹고 2시간 뒤 복통)"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            touch()
          }}
        />

        <div className="flex items-center gap-3">
          <button type="button" className={secondaryClass} disabled={!dirty || status.pending} onClick={() => void save()}>
            {status.pending ? '저장 중…' : `${label} 저장`}
          </button>
          {status.message && (
            <span className={`text-xs ${status.error ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>{status.message}</span>
          )}
          {dirty && !status.pending && <span className="text-xs text-neutral-400">저장 안 됨</span>}
        </div>
      </div>
    </div>
  )
}
