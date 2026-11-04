import { useState } from 'react'
import { deleteMeal, SEVERITY_LABEL, SYMPTOM_LABEL, type MealLog } from '../../lib/health.ts'
import { secondaryClass } from '../styles.ts'
import { MealCard } from './MealCard.tsx'

// 그날의 간식 목록. 하루에 여러 건 쌓을 수 있고, 한 건씩 펼쳐서 수정한다.
export function SnackList({
  date,
  snacks,
  foodSuggestions,
  onChange,
}: {
  date: string
  snacks: MealLog[]
  foodSuggestions: string[]
  onChange: () => void
}) {
  // 수정 중인 간식 id, 새 간식 입력 중이면 'new'. 기록이 없는 날은 바로 입력 카드를 연다.
  const [editing, setEditing] = useState<string | null>(snacks.length === 0 ? 'new' : null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const done = () => {
    setEditing(null)
    onChange()
  }

  async function remove(snack: MealLog, index: number) {
    if (!confirm(`간식 ${index + 1}을 삭제할까요?`)) return
    setPending(true)
    setError(null)
    try {
      await deleteMeal(snack.id)
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {snacks.map((s, i) =>
        editing === s.id ? (
          <MealCard
            key={s.id}
            date={date}
            meal="snack"
            label={`간식 ${i + 1}`}
            initial={s}
            foodSuggestions={foodSuggestions}
            onSaved={done}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div key={s.id} className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <span className="mt-0.5 shrink-0 text-xs font-semibold text-neutral-500">간식 {i + 1}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{s.foods.join(', ') || '음식 없음'}</p>
              {s.symptoms.length > 0 && (
                <p className="mt-0.5 text-red-600 dark:text-red-400">
                  {s.symptoms.map((k) => SYMPTOM_LABEL[k]).join(', ')}
                  {s.severity && ` · ${SEVERITY_LABEL[s.severity]}`}
                </p>
              )}
              {s.note && <p className="mt-0.5 text-neutral-500">{s.note}</p>}
            </div>
            <div className="flex shrink-0 gap-3">
              <button type="button" className="text-xs text-neutral-500" disabled={pending} onClick={() => setEditing(s.id)}>
                수정
              </button>
              <button
                type="button"
                className="text-xs text-red-600 disabled:opacity-50 dark:text-red-400"
                disabled={pending}
                onClick={() => void remove(s, i)}
              >
                삭제
              </button>
            </div>
          </div>
        ),
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {editing === 'new' ? (
        <MealCard
          key={`new-${snacks.length}`}
          date={date}
          meal="snack"
          label={`간식 ${snacks.length + 1}`}
          initial={undefined}
          foodSuggestions={foodSuggestions}
          onSaved={done}
          onCancel={snacks.length > 0 ? () => setEditing(null) : undefined}
        />
      ) : (
        <button type="button" className={secondaryClass} onClick={() => setEditing('new')}>
          + 간식 추가
        </button>
      )}
    </div>
  )
}
