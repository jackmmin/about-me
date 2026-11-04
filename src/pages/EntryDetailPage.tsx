import { Link, useParams } from 'react-router'
import { Markdown } from '../components/Markdown.tsx'
import { secondaryClass } from '../components/styles.ts'
import { StatusMessage, TagChip } from '../components/ui.tsx'
import { formatPassage } from '../lib/bible.ts'
import { getEntry } from '../lib/entries.ts'
import { formatDate } from '../lib/format.ts'
import { ENTRY_TYPE_LABEL, ENTRY_TYPE_PATH } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'

export function EntryDetailPage() {
  const { id = '' } = useParams()
  const { data: entry, error, loading } = useLoad(() => getEntry(id), [id])
  const urls = useSignedUrls(entry?.images.map((img) => img.storage_path) ?? [])

  if (!entry) return <StatusMessage loading={loading} error={error} empty="기록을 찾을 수 없습니다." />

  return (
    <article>
      <div className="mb-4 flex items-center justify-between">
        <Link to={ENTRY_TYPE_PATH[entry.type]} className="text-sm text-neutral-500">
          ← {ENTRY_TYPE_LABEL[entry.type]}
        </Link>
        <Link to={`/entries/${entry.id}/edit`} className={secondaryClass}>
          수정
        </Link>
      </div>

      <p className="text-sm text-neutral-500">{formatDate(entry.record_date)}</p>
      {/* 묵상은 제목이 선택이라, 없으면 말씀이 제목 자리를 대신한다 */}
      {(entry.title || entry.type !== 'meditation') && <h1 className="mt-1 text-2xl font-bold">{entry.title || '제목 없음'}</h1>}
      {entry.passages.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {entry.passages.map((p, i) => (
            <li key={i} className="border-l-2 border-neutral-300 pl-3 text-lg font-semibold dark:border-neutral-700">
              {formatPassage(p)}
            </li>
          ))}
        </ul>
      )}
      {entry.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.tags.map((t) => (
            <TagChip key={t} name={t} />
          ))}
        </div>
      )}

      {entry.images.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {entry.images.map((img) => (
            <figure key={img.id}>
              <a href={urls[img.storage_path]} target="_blank" rel="noreferrer">
                <div className="overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  {urls[img.storage_path] ? (
                    <img src={urls[img.storage_path]} alt={img.caption} className="w-full" />
                  ) : (
                    <div className="aspect-[4/3]" />
                  )}
                </div>
              </a>
              {img.caption && <figcaption className="mt-1.5 text-sm text-neutral-500">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {entry.content && (
        <div className="mt-6">
          <Markdown>{entry.content}</Markdown>
        </div>
      )}
    </article>
  )
}
