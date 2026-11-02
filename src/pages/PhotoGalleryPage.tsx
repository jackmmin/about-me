import { useState } from 'react'
import { Link } from 'react-router'
import { primaryClass, secondaryClass } from '../components/styles.ts'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { listEntries } from '../lib/entries.ts'
import { formatMonth } from '../lib/format.ts'
import { thumbPath } from '../lib/images.ts'
import type { Entry, EntryImage } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'

const PAGE_SIZE = 100

interface Photo {
  image: EntryImage
  entry: Entry
}

// 앨범과 일기에 붙은 사진을 모두 모아 월별 그리드로 보여준다.
export function PhotoGalleryPage() {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const { data, error, loading } = useLoad(() => listEntries({ limit }), [limit])

  const entries = data ?? []
  const photos: Photo[] = entries.flatMap((entry) => entry.images.map((image) => ({ image, entry })))
  const urls = useSignedUrls(photos.map((p) => thumbPath(p.image.storage_path)))

  const groups = new Map<string, Photo[]>()
  for (const p of photos) {
    const month = p.entry.record_date.slice(0, 7)
    groups.set(month, [...(groups.get(month) ?? []), p])
  }

  return (
    <section>
      <PageHeader
        title="사진"
        description="앨범과 일기에 남긴 사진"
        actions={
          <Link to="/entries/new?type=photo" className={primaryClass}>
            새 앨범
          </Link>
        }
      />

      {photos.length === 0 ? (
        <StatusMessage loading={loading} error={error} empty="아직 사진이 없습니다." />
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups].map(([month, items]) => (
            <div key={month}>
              <h2 className="mb-2 text-sm font-semibold text-neutral-500">{formatMonth(`${month}-01`)}</h2>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
                {items.map(({ image, entry }) => (
                  <Link
                    key={image.id}
                    to={`/entries/${entry.id}`}
                    className="relative aspect-square overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800"
                    title={entry.title}
                  >
                    {urls[thumbPath(image.storage_path)] && (
                      <img
                        src={urls[thumbPath(image.storage_path)]}
                        alt={image.caption || entry.title}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {entry.type === 'diary' && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        일기
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
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
