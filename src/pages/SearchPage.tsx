import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EntryCard } from '../components/EntryCard.tsx'
import { fieldClass } from '../components/styles.ts'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { sanitizeQuery, searchEntries } from '../lib/entries.ts'
import { formatDate } from '../lib/format.ts'
import { searchHealth } from '../lib/health.ts'
import { thumbPath } from '../lib/images.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'

type Filter = 'all' | 'diary' | 'photo' | 'health'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'diary', label: '일기' },
  { key: 'photo', label: '사진' },
  { key: 'health', label: '건강' },
]

// 검색어 주변 문맥만 잘라서 보여준다.
function snippet(text: string, term: string, radius = 30) {
  const i = text.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return text.slice(0, radius * 2)
  const start = Math.max(0, i - radius)
  const end = Math.min(text.length, i + term.length + radius)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

export function SearchPage() {
  // 검색어를 주소(?q=)에 남겨서 결과에서 뒤로 가기 해도 유지되게 한다.
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState(params.get('q') ?? '')
  const [filter, setFilter] = useState<Filter>('all')
  const term = sanitizeQuery(params.get('q') ?? '')

  // 입력을 멈추고 0.3초 뒤 검색
  useEffect(() => {
    const timer = setTimeout(() => setParams(input ? { q: input } : {}, { replace: true }), 300)
    return () => clearTimeout(timer)
  }, [input, setParams])

  const { data, error, loading } = useLoad(
    async () => (term ? { entries: await searchEntries(term), health: await searchHealth(term) } : null),
    [term],
  )

  const entries = (data?.entries ?? []).filter((e) => filter === 'all' || filter === e.type)
  const health = filter === 'all' || filter === 'health' ? (data?.health ?? []) : []
  const showEntries = filter !== 'health'
  const thumbs = useSignedUrls(entries.flatMap((e) => (e.images[0] ? [thumbPath(e.images[0].storage_path)] : [])))
  const count = (showEntries ? entries.length : 0) + health.length

  return (
    <section>
      <PageHeader title="검색" />
      <input
        className={fieldClass}
        type="search"
        autoFocus
        placeholder="제목, 본문, 태그, 음식, 운동"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className="my-4 flex gap-1.5" role="radiogroup" aria-label="유형">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="radio"
            aria-checked={filter === f.key}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.key ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!term ? (
        <StatusMessage empty="검색어를 입력하세요." />
      ) : count === 0 ? (
        <StatusMessage loading={loading} error={error} empty={`'${term}'에 대한 결과가 없습니다.`} />
      ) : (
        <div className="flex flex-col gap-3">
          {showEntries &&
            entries.map((e) => (
              <EntryCard key={e.id} entry={e} showType thumbUrl={e.images[0] && thumbs[thumbPath(e.images[0].storage_path)]} />
            ))}
          {health.map((h, i) => (
            <Link
              key={`${h.log_date}-${h.field}-${i}`}
              to={`/health?date=${h.log_date}`}
              className="rounded-xl border border-neutral-200 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <p className="text-xs text-neutral-500">
                <span className="mr-1.5 font-semibold">건강 · {h.field}</span>
                {formatDate(h.log_date)}
              </p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{snippet(h.text, term)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
