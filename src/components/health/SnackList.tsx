import { useState } from 'react'
import type { MealLog } from '../../lib/health.ts'
import { secondaryClass } from '../styles.ts'
import { MealCard } from './MealCard.tsx'

let seq = 0
const blank = () => ({ key: `new-${++seq}`, initial: undefined })

// 그날의 간식 목록. 카드마다 바로 고치고 자동 저장하며, 아래 버튼으로 새 간식 카드를 붙인다.
// 카드 목록은 여기서 들고 있어서, 새 간식이 저장된 뒤 다시 불러와도 카드가 겹치지 않는다.
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
  // 기록이 없는 날은 빈 카드 하나를 열어 둔다.
  const [cards, setCards] = useState<{ key: string; initial: MealLog | undefined }[]>(() =>
    snacks.length ? snacks.map((s) => ({ key: s.id, initial: s })) : [blank()],
  )

  return (
    <div className="flex flex-col gap-2">
      {cards.map((c, i) => (
        <MealCard
          key={c.key}
          date={date}
          meal="snack"
          label={`간식 ${i + 1}`}
          initial={c.initial}
          foodSuggestions={foodSuggestions}
          onSaved={onChange}
          onDeleted={() => setCards((prev) => prev.filter((x) => x.key !== c.key))}
        />
      ))}
      <button type="button" className={secondaryClass} onClick={() => setCards((prev) => [...prev, blank()])}>
        + 간식 추가
      </button>
    </div>
  )
}
