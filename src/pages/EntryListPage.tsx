import { useState } from 'react'
import { Link } from 'react-router'
import { EntryCard } from '../components/EntryCard.tsx'
import { primaryClass, secondaryClass } from '../components/styles.ts'
import { PageHeader, StatusMessage, TagChip } from '../components/ui.tsx'
import { listEntries } from '../lib/entries.ts'
import { coverThumbPath } from '../lib/images.ts'
import type { EntryType } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'

const PAGE_SIZE = 30

const LIST_INFO: Record<ListType, { title: string; description: string; newLabel: string }> = {
  diary: { title: '일기', description: '일상과 하루의 기록', newLabel: '새 일기' },
  meditation: { title: '묵상', description: '말씀과 묵상', newLabel: '새 묵상' },
}

type ListType = Exclude<EntryType, 'photo'> // 사진은 PhotoGalleryPage

// 일기·묵상 목록 (홈은 HomePage)
export function EntryListPage({ type }: { type: ListType }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [tag, setTag] = useState<string | null>(null)
  const { data, error, loading } = useLoad(() => listEntries({ type, limit }), [type, limit])

  const entries = data ?? []
  const visible = tag ? entries.filter((e) => e.tags.includes(tag)) : entries
  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort()
  const info = LIST_INFO[type]
  const thumbs = useSignedUrls(visible.flatMap((e) => coverThumbPath(e) ?? []))

  return (
    <section>
      <PageHeader
        title={info.title}
        description={info.description}
        actions={
          <Link to={`/entries/new?type=${type}`} className={primaryClass}>
            {info.newLabel}
          </Link>
        }
      />

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {allTags.map((t) => (
            <TagChip key={t} name={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)} />
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <StatusMessage loading={loading} error={error} empty="아직 기록이 없습니다." />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((e) => (
            <EntryCard key={e.id} entry={e} thumbUrl={thumbs[coverThumbPath(e) ?? '']} />
          ))}
        </div>
      )}

      {entries.length === limit && (
        <button className={`${secondaryClass} mt-4 w-full`} disabled={loading} onClick={() => setLimit(limit + PAGE_SIZE)}>
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </section>
  )
}
