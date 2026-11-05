import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EntryCalendar } from '../components/EntryCalendar.tsx'
import { EntryCard } from '../components/EntryCard.tsx'
import { primaryClass, secondaryClass } from '../components/styles.ts'
import { Tabs } from '../components/Tabs.tsx'
import { PageHeader, StatusMessage, TagChip } from '../components/ui.tsx'
import { listEntries } from '../lib/entries.ts'
import { today } from '../lib/format.ts'
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
type View = 'list' | 'calendar'

// 일기·묵상 목록 (홈은 HomePage). 달력으로도 본다: ?view=calendar&month=YYYY-MM&day=YYYY-MM-DD
// (뒤로 가기로 돌아와도 보던 달·날짜가 유지되도록 주소에 담는다)
export function EntryListPage({ type }: { type: ListType }) {
  const [params, setParams] = useSearchParams()
  const info = LIST_INFO[type]
  const view: View = params.get('view') === 'calendar' ? 'calendar' : 'list'
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : today().slice(0, 7)
  const day = params.get('day')

  function navigate(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  return (
    <section>
      <PageHeader
        title={info.title}
        description={info.description}
        actions={
          <>
            <Link to={`/${type}/stats`} className={secondaryClass}>
              통계
            </Link>
            <Link to={`/entries/new?type=${type}`} className={primaryClass}>
              {info.newLabel}
            </Link>
          </>
        }
      />

      <div className="mb-4">
        <Tabs<View>
          items={[
            { key: 'list', label: '목록' },
            { key: 'calendar', label: '달력' },
          ]}
          value={view}
          onChange={(v) => navigate(v === 'calendar' ? { view: 'calendar', day: today() } : { view: null, month: null, day: null })}
          variant="secondary"
          label="보기 방식"
        />
      </div>

      {view === 'calendar' ? (
        <EntryCalendar key={`${type}:${month}`} type={type} month={month} selected={day} onNavigate={(m, d) => navigate({ month: m, day: d })} />
      ) : (
        <EntryList type={type} />
      )}
    </section>
  )
}

function EntryList({ type }: { type: ListType }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [tag, setTag] = useState<string | null>(null)
  const { data, error, loading } = useLoad(() => listEntries({ type, limit }), [type, limit], `entries:${type}:${limit}`)

  const entries = data ?? []
  const visible = tag ? entries.filter((e) => e.tags.includes(tag)) : entries
  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort()
  const thumbs = useSignedUrls(visible.flatMap((e) => coverThumbPath(e) ?? []))

  return (
    <>
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
    </>
  )
}
