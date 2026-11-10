import { useEffect, useRef, useState } from 'react'
import { deleteMeal, SEVERITY_LABEL, SYMPTOMS, saveMeal, type MealKey, type MealLog, type SymptomKey } from '../../lib/health.ts'
import { fieldClass } from '../styles.ts'
import { TagInput } from '../TagInput.tsx'

interface Draft {
  foods: string[]
  symptoms: SymptomKey[]
  severity: number | null
  note: string
}

// 메모는 입력이 멈추면 저장한다
const NOTE_DELAY = 800

// 끼니 하나: 먹은 음식, 식후 증상(체크 + 정도), 메모. 바꾸는 즉시 자동 저장한다.
// 간식은 한 건마다 카드 하나 (onDeleted가 있으면 삭제 후 카드를 목록에서 빼고, 저장 전 카드도 닫을 수 있다).
export function MealCard({
  date,
  meal,
  label,
  initial,
  foodSuggestions,
  onSaved,
  onDeleted,
}: {
  date: string
  meal: MealKey
  label: string
  initial: MealLog | undefined
  foodSuggestions: string[]
  onSaved: () => void
  onDeleted?: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    foods: initial?.foods ?? [],
    symptoms: initial?.symptoms ?? [],
    severity: initial?.severity ?? null,
    note: initial?.note ?? '',
  }))
  // 처음 저장하면 id가 생긴다. 이후 저장은 같은 행을 수정한다.
  const [id, setId] = useState(initial?.id ?? null)
  const [status, setStatus] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ state: 'idle' })

  // 저장은 한 번에 하나만. 저장 중에 또 바뀌면 끝난 뒤 최신 값으로 한 번 더 저장한다 (첫 insert가 두 번 되지 않게).
  const latest = useRef(draft)
  const idRef = useRef(id)
  const changed = useRef(false)
  const saving = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  })

  async function flush() {
    window.clearTimeout(timer.current)
    timer.current = undefined
    if (saving.current) return
    saving.current = true
    setStatus({ state: 'saving' })
    try {
      while (changed.current) {
        changed.current = false
        const d = latest.current
        idRef.current = await saveMeal({
          id: idRef.current,
          log_date: date,
          meal,
          foods: d.foods,
          symptoms: d.symptoms,
          severity: d.symptoms.length ? d.severity : null,
          note: d.note.trim(),
        })
      }
      setId(idRef.current)
      setStatus({ state: 'saved' })
      onSavedRef.current()
    } catch (e) {
      changed.current = true
      setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      saving.current = false
    }
  }

  // 날짜를 옮기는 등으로 카드가 사라질 때, 기다리던 메모 저장을 마저 한다.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })
  useEffect(
    () => () => {
      if (timer.current !== undefined) void flushRef.current()
    },
    [],
  )

  function change(next: Partial<Draft>, delay = 0) {
    latest.current = { ...latest.current, ...next }
    setDraft(latest.current)
    changed.current = true
    window.clearTimeout(timer.current)
    if (delay > 0) timer.current = window.setTimeout(() => void flush(), delay)
    else void flush()
  }

  function toggleSymptom(key: SymptomKey) {
    const symptoms = draft.symptoms.includes(key) ? draft.symptoms.filter((s) => s !== key) : [...draft.symptoms, key]
    change(symptoms.length ? { symptoms } : { symptoms, severity: null })
  }

  async function remove() {
    if (!confirm(`이 ${label} 기록을 삭제할까요?`)) return
    // 아직 저장 안 된 간식 카드는 그냥 닫는다
    if (!id) {
      window.clearTimeout(timer.current)
      timer.current = undefined
      onDeleted?.()
      return
    }
    window.clearTimeout(timer.current)
    timer.current = undefined
    saving.current = true
    setStatus({ state: 'saving' })
    try {
      await deleteMeal(id)
      changed.current = false
      idRef.current = null
      setId(null)
      latest.current = { foods: [], symptoms: [], severity: null, note: '' }
      setDraft(latest.current)
      setStatus({ state: 'idle' })
      onSavedRef.current()
      onDeleted?.()
    } catch (e) {
      setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      saving.current = false
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-col gap-3">
        {onDeleted && <p className="text-xs font-semibold text-neutral-500">{label}</p>}
        <TagInput
          value={draft.foods}
          onChange={(foods) => change({ foods })}
          suggestions={foodSuggestions}
          prefix=""
          itemLabel="음식"
          placeholder="먹은 음식 입력 후 Enter (예: 우유)"
        />

        <div>
          <p className="mb-1.5 text-xs text-neutral-500">식후 증상</p>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => {
              const on = draft.symptoms.includes(s.key)
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

        {draft.symptoms.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-neutral-500">정도</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="증상 정도">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={draft.severity === n}
                  className={`w-12 rounded-lg border py-1 text-sm ${
                    draft.severity === n
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                  onClick={() => change({ severity: draft.severity === n ? null : n })}
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
          value={draft.note}
          onChange={(e) => change({ note: e.target.value }, NOTE_DELAY)}
          onBlur={() => timer.current !== undefined && void flush()}
        />

        <div className="flex min-h-5 items-center gap-3 text-xs">
          {status.state === 'saving' && <span className="text-neutral-400">저장 중…</span>}
          {status.state === 'saved' && <span className="text-neutral-400">{id ? '저장됨' : '비워서 기록을 지웠습니다'}</span>}
          {status.state === 'error' && (
            <>
              <span className="text-red-600 dark:text-red-400">저장 실패: {status.message}</span>
              <button type="button" className="underline" onClick={() => void flush()}>
                다시 시도
              </button>
            </>
          )}
          {(id || onDeleted) && (
            <button
              type="button"
              className="ml-auto text-red-600 disabled:opacity-50 dark:text-red-400"
              disabled={status.state === 'saving'}
              onClick={() => void remove()}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
