import { useId, useRef, useState } from 'react'
import { fieldClass } from './styles.ts'

// Enter 또는 쉼표로 항목(태그·음식 등) 추가. 한글 입력 조합 중의 Enter는 무시한다.
// 이전 이력 목록은 <datalist> 대신 직접 그린다. 모바일에서 datalist 팝업은 키패드가 올라오며
// 화면 크기가 바뀌는 순간 깨지거나 닫히기 때문이다.
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
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1) // 방향키로 고른 항목 (-1이면 없음)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const query = text.trim().replace(/^#/, '').toLowerCase()
  const matches = suggestions
    .filter((s) => !value.includes(s) && (!query || s.toLowerCase().includes(query)))
    .slice(0, 50)
  const showList = open && matches.length > 0

  function add(raw: string) {
    const name = raw.trim().replace(/^#/, '')
    if (name && !value.includes(name)) onChange([...value, name])
    setText('')
    setActive(-1)
  }

  // 키패드가 올라와 화면이 줄어들면 입력 칸과 목록이 보이도록 가운데로 스크롤한다
  function keepInView() {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    vv.addEventListener('resize', onResize)
    setTimeout(() => vv.removeEventListener('resize', onResize), 1000)
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
      <div className="relative">
        <input
          ref={inputRef}
          className={fieldClass}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onFocus={() => {
            setOpen(true)
            keepInView()
          }}
          onChange={(e) => {
            setOpen(true)
            setActive(-1)
            if (e.target.value.endsWith(',')) add(e.target.value.slice(0, -1))
            else setText(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'ArrowDown' && matches.length > 0) {
              e.preventDefault()
              setOpen(true)
              setActive((i) => (i + 1) % matches.length)
            } else if (e.key === 'ArrowUp' && matches.length > 0) {
              e.preventDefault()
              setActive((i) => (i <= 0 ? matches.length - 1 : i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              add(showList && active >= 0 ? matches[active] : text)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          onBlur={() => {
            setOpen(false)
            if (text) add(text)
          }}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          >
            {matches.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === active}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                // 누르는 순간 입력 칸 포커스가 빠지면 키패드가 내려가고 목록이 닫히므로 막는다
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => add(s)}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
