import { useState } from 'react'
import { Link } from 'react-router'
import { EntryCard } from '../components/EntryCard.tsx'
import { primaryClass, secondaryClass } from '../components/styles.ts'
import { PageHeader, StatusMessage, TagChip } from '../components/ui.tsx'
import { listEntries } from '../lib/entries.ts'
import { thumbPath } from '../lib/images.ts'
import type { EntryType } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'

const PAGE_SIZE = 30

// type이 없으면 홈(모든 유형의 최근 기록), 있으면 해당 유형 목록
export function EntryListPage({ type }: { type?: EntryType }) {
  const [limit, setLimit] = useState(type ? PAGE_SIZE : 20)
  const [tag, setTag] = useState<string | null>(null)
  const { data, error, loading } = useLoad(() => listEntries({ type, limit }), [type, limit])

  const entries = data ?? []
  const visible = tag ? entries.filter((e) => e.tags.includes(tag)) : entries
  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort()
  const thumbs = useSignedUrls(visible.flatMap((e) => (e.images[0] ? [thumbPath(e.images[0].storage_path)] : [])))

  const actions = type ? (
    <Link to={`/entries/new?type=${type}`} className={primaryClass}>
      새 일기
    </Link>
  ) : (
    <>
      <Link to="/entries/new?type=diary" className={primaryClass}>
        새 일기
      </Link>
      <Link to="/entries/new?type=photo" className={secondaryClass}>
        새 앨범
      </Link>
    </>
  )

  return (
    <section>
      <PageHeader title={type ? '일기' : '홈'} description={type ? '일상과 하루의 기록' : '최근 기록'} actions={actions} />

      {type && allTags.length > 0 && (
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
            <EntryCard
              key={e.id}
              entry={e}
              showType={!type}
              thumbUrl={e.images[0] && thumbs[thumbPath(e.images[0].storage_path)]}
            />
          ))}
        </div>
      )}

      {type && entries.length === limit && (
        <button className={`${secondaryClass} mt-4 w-full`} disabled={loading} onClick={() => setLimit(limit + PAGE_SIZE)}>
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </section>
  )
}
