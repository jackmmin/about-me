import { useState } from 'react'
import { fieldClass } from './styles.ts'

// Enter 또는 쉼표로 태그 추가. 한글 입력 조합 중의 Enter는 무시한다.
export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const [text, setText] = useState('')

  function add(raw: string) {
    const name = raw.trim().replace(/^#/, '')
    if (name && !value.includes(name)) onChange([...value, name])
    setText('')
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs dark:bg-neutral-800"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`${tag} 태그 삭제`}
            >
              #{tag} ✕
            </button>
          ))}
        </div>
      )}
      <input
        className={fieldClass}
        list="tag-suggestions"
        placeholder="태그 입력 후 Enter"
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
      <datalist id="tag-suggestions">
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  )
}
