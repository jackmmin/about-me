import { useState } from 'react'
import { BIBLE_BOOKS, formatPassage, getBook } from '../lib/bible.ts'
import type { Passage } from '../lib/types.ts'
import { BookPicker } from './BookPicker.tsx'
import { fieldClass, secondaryClass } from './styles.ts'

const chipClass = (active: boolean) =>
  `rounded-full px-2.5 py-1 text-xs ${
    active ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'
  }`

// 묵상 말씀 목록 편집: 말씀을 여러 개 등록하고, 각 말씀은 책 → 장 → 절(체크박스)로 고른다.
export function PassagePicker({ value, onChange }: { value: Passage[]; onChange: (v: Passage[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null)

  function add() {
    // 직전 말씀과 같은 책·장에서 시작 (이어지는 구절을 추가하는 경우가 많음)
    const last = value.at(-1)
    onChange([...value, { book: last?.book ?? 'Gen', chapter: last?.chapter ?? 1, verses: [] }])
    setEditing(value.length)
  }

  function update(index: number, p: Passage) {
    onChange(value.map((v, i) => (i === index ? p : v)))
  }

  function remove(index: number) {
    if (!confirm('이 말씀을 삭제할까요?')) return
    onChange(value.filter((_, i) => i !== index))
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">말씀</p>
      {value.map((p, i) =>
        editing === i ? (
          <PassageEditor key={i} value={p} onChange={(v) => update(i, v)} onDone={() => setEditing(null)} onRemove={() => remove(i)} />
        ) : (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <p className="min-w-0 flex-1 truncate text-sm">{formatPassage(p)}</p>
            <button type="button" className="text-sm text-neutral-500" onClick={() => setEditing(i)}>
              수정
            </button>
            <button type="button" className="text-sm text-red-600 dark:text-red-400" onClick={() => remove(i)}>
              삭제
            </button>
          </div>
        ),
      )}
      <button type="button" className={secondaryClass} onClick={add}>
        + 말씀 추가
      </button>
    </div>
  )
}

function PassageEditor({
  value,
  onChange,
  onDone,
  onRemove,
}: {
  value: Passage
  onChange: (v: Passage) => void
  onDone: () => void
  onRemove: () => void
}) {
  const [rangeMode, setRangeMode] = useState(false)
  const [anchor, setAnchor] = useState<number | null>(null)
  const book = getBook(value.book) ?? BIBLE_BOOKS[0]
  const verseCount = book.verses[value.chapter - 1] ?? 0
  const selected = new Set(value.verses)

  const setVerses = (verses: Iterable<number>) => onChange({ ...value, verses: [...new Set(verses)].sort((a, b) => a - b) })

  function handleVerse(n: number) {
    if (!rangeMode) {
      const next = new Set(selected)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return setVerses(next)
    }
    // 범위 선택: 시작 절 → 끝 절을 누르면 사이의 절을 모두 체크
    if (anchor === null) {
      setAnchor(n)
      return setVerses([...selected, n])
    }
    const [from, to] = anchor <= n ? [anchor, n] : [n, anchor]
    setVerses([...selected, ...Array.from({ length: to - from + 1 }, (_, i) => from + i)])
    setAnchor(null)
  }

  function toggleRangeMode() {
    setRangeMode(!rangeMode)
    setAnchor(null)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
      <div className="flex gap-2">
        <BookPicker
          value={book.id}
          onChange={(id) => {
            setAnchor(null)
            onChange({ book: id, chapter: 1, verses: [] })
          }}
        />
        {/* fieldClass의 w-full이 w-28을 덮어쓰므로 max-w로 폭을 고정한다 */}
        <select
          className={`${fieldClass} max-w-28 shrink-0`}
          aria-label="장"
          value={value.chapter}
          onChange={(e) => {
            setAnchor(null)
            onChange({ ...value, chapter: Number(e.target.value), verses: [] })
          }}
        >
          {book.verses.map((_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
              {book.id === 'Ps' ? '편' : '장'}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={chipClass(rangeMode)} aria-pressed={rangeMode} onClick={toggleRangeMode}>
          범위 선택
        </button>
        <button type="button" className={chipClass(false)} onClick={() => setVerses(Array.from({ length: verseCount }, (_, i) => i + 1))}>
          전체 선택
        </button>
        <button
          type="button"
          className={chipClass(false)}
          onClick={() => {
            setAnchor(null)
            setVerses([])
          }}
        >
          선택 해제
        </button>
        {rangeMode && (
          <span className="text-xs text-neutral-500">{anchor === null ? '시작 절을 누르세요' : `${anchor}절부터 끝 절을 누르세요`}</span>
        )}
      </div>

      <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
        {Array.from({ length: verseCount }, (_, i) => i + 1).map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="checkbox" className="peer sr-only" checked={selected.has(n)} onChange={() => handleVerse(n)} />
            <span
              className={`flex h-9 items-center justify-center rounded-md border text-sm tabular-nums select-none peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-400 dark:peer-checked:border-white dark:peer-checked:bg-white dark:peer-checked:text-neutral-900 ${
                anchor === n ? 'ring-2 ring-neutral-400' : ''
              } border-neutral-200 dark:border-neutral-800`}
            >
              {n}
            </span>
          </label>
        ))}
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {formatPassage(value)}
        {value.verses.length === 0 && <span className="text-neutral-400"> (절을 고르지 않으면 장 전체)</span>}
      </p>

      <div className="flex gap-2">
        <button type="button" className={`${secondaryClass} flex-1`} onClick={onDone}>
          완료
        </button>
        <button type="button" className="px-2 text-sm text-red-600 dark:text-red-400" onClick={onRemove}>
          삭제
        </button>
      </div>
    </div>
  )
}
