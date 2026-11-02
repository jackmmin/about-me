import { useId, useState } from 'react'
import { fieldClass } from './styles.ts'

// Enter 또는 쉼표로 항목(태그·음식 등) 추가. 한글 입력 조합 중의 Enter는 무시한다.
export function TagInput({
  value,
  onChange,
  suggestions,
  prefix = '#',
  placeholder = '태그 입력 후 Enter',
  itemLabel = '태그',
}: {
  value: string[]
  onChange: (items: string[]) => void
  suggestions: string[]
  prefix?: string
  placeholder?: string
  itemLabel?: string
}) {
  const [text, setText] = useState('')
  const listId = useId() // 한 화면에 여러 개 있어도 자동완성 목록이 섞이지 않게

  function add(raw: string) {
    const name = raw.trim().replace(/^#/, '')
    if (name && !value.includes(name)) onChange([...value, name])
    setText('')
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs dark:bg-neutral-800"
              onClick={() => onChange(value.filter((t) => t !== item))}
              aria-label={`${item} ${itemLabel} 삭제`}
            >
              {prefix}
              {item} ✕
            </button>
          ))}
        </div>
      )}
      <input
        className={fieldClass}
        list={listId}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value.slice(0, -1))
          else setText(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            add(text)
          }
        }}
        onBlur={() => text && add(text)}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .slice(0, 50)
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  )
}
