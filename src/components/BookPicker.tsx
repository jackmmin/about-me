import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { BIBLE_BOOKS, getBook, type BibleBook } from '../lib/bible.ts'
import { keepInView } from '../lib/keepInView.ts'
import { fieldClass } from './styles.ts'

const CHOSUNG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const TESTAMENT_LABEL = { old: '구약', new: '신약' } as const

// '고린도전서' → 'ㄱㄹㄷㅈㅅ' (한글 음절이 아닌 글자는 그대로)
function initials(text: string) {
  return [...text]
    .map((ch) => {
      const code = ch.charCodeAt(0) - 0xac00
      return code >= 0 && code < 11172 ? CHOSUNG[Math.floor(code / 588)] : ch
    })
    .join('')
}

const isChosungOnly = (q: string) => [...q].every((ch) => CHOSUNG.includes(ch))
const INITIALS = new Map(BIBLE_BOOKS.map((b) => [b.id, initials(b.name)]))

// 이름 일부('요한'), 약칭('롬', '고전'), 초성('ㄱㄹㄷㅈㅅ')으로 찾는다
function search(query: string) {
  const q = query.replace(/\s+/g, '')
  if (!q) return BIBLE_BOOKS
  if (isChosungOnly(q)) return BIBLE_BOOKS.filter((b) => INITIALS.get(b.id)!.includes(q))
  return BIBLE_BOOKS.filter((b) => b.name.includes(q) || b.short.startsWith(q))
}

// 성경 책 선택: 입력해서 검색하거나 ▾ 버튼으로 전체 목록을 펼친다.
// 기본 <select>는 PC 다크 모드에서 목록 글자가 안 보이고 검색도 안 되어 직접 그린다.
export function BookPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const book = getBook(value) ?? BIBLE_BOOKS[0]
  const [text, setText] = useState<string | null>(null) // 입력 중인 검색어 (null이면 선택된 책 이름 표시)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1) // 방향키로 고른 항목 (-1이면 없음)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const matches = text === null ? BIBLE_BOOKS : search(text)

  function close() {
    setOpen(false)
    setText(null)
    setActive(-1)
  }

  function choose(b: BibleBook) {
    inputRef.current?.blur() // 키패드 내리기. onBlur가 먼저 돌아도 아래 선택이 마지막에 반영된다
    if (b.id !== book.id) onChange(b.id)
    close()
  }

  // 펼치면 선택된 책(또는 방향키로 고른 책)이 보이게 스크롤
  useEffect(() => {
    if (!open) return
    const id = active >= 0 ? matches[active]?.id : book.id
    listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active])

  // ▾ 버튼으로 펼친 경우(입력 칸 포커스 없음) 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        className={`${fieldClass} pr-10`}
        role="combobox"
        aria-label="책"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="책 이름·초성 검색"
        value={text ?? book.name}
        onFocus={(e) => {
          e.target.select()
          setOpen(true)
          keepInView(inputRef.current)
        }}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(-1)
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
            e.preventDefault() // 폼 저장 막기
            const pick = matches[active >= 0 ? active : 0]
            if (open && text !== null && pick) choose(pick)
          } else if (e.key === 'Escape') {
            close()
          }
        }}
        onBlur={() => {
          // 이름·약칭을 정확히 쳤으면 그 책으로, 아니면 원래 책으로 되돌린다
          const q = text?.trim()
          const exact = q ? BIBLE_BOOKS.find((b) => b.name === q || b.short === q) : undefined
          if (exact && exact.id !== book.id) onChange(exact.id)
          close()
        }}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-500"
        aria-label="책 목록 펼치기"
        tabIndex={-1}
        // 입력 칸 포커스를 뺏지 않는다 (뺏으면 onBlur로 목록이 닫혔다가 다시 열린다)
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) return close()
          setText(null)
          setActive(-1)
          setOpen(true)
        }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-neutral-400">일치하는 책이 없습니다</li>}
          {matches.map((b, i) => (
            <Fragment key={b.id}>
              {b.testament !== matches[i - 1]?.testament && (
                <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-semibold text-neutral-500">
                  {TESTAMENT_LABEL[b.testament]}
                </li>
              )}
              <li
                role="option"
                data-id={b.id}
                aria-selected={b.id === book.id}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 ${
                  i === active ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                } ${b.id === book.id ? 'font-semibold' : ''}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(b)}
              >
                {b.name}
                {b.id === book.id && <span aria-hidden="true">✓</span>}
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}
