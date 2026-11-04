import { Link } from 'react-router'
import { formatPassages } from '../lib/bible.ts'
import { excerpt, formatDate } from '../lib/format.ts'
import { ENTRY_TYPE_LABEL, type Entry } from '../lib/types.ts'
import { TagChip } from './ui.tsx'

export function EntryCard({ entry, thumbUrl, showType }: { entry: Entry; thumbUrl?: string; showType?: boolean }) {
  const preview = excerpt(entry.content)
  const passages = formatPassages(entry.passages)
  return (
    <Link
      to={`/entries/${entry.id}`}
      className="flex gap-4 rounded-xl border border-neutral-200 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-500">
          {showType && <span className="mr-1.5 font-semibold">{ENTRY_TYPE_LABEL[entry.type]}</span>}
          {formatDate(entry.record_date)}
          {entry.images.length > 0 && <span className="ml-1.5">· 사진 {entry.images.length}</span>}
        </p>
        <p className="mt-1 truncate font-semibold">{entry.title || passages || '제목 없음'}</p>
        {entry.title && passages && <p className="mt-0.5 truncate text-sm text-neutral-500">{passages}</p>}
        {preview && <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{preview}</p>}
        {entry.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {entry.tags.map((t) => (
              <TagChip key={t} name={t} />
            ))}
          </div>
        )}
      </div>
      {entry.images.length > 0 && (
        <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
          {thumbUrl && <img src={thumbUrl} alt="" className="size-full object-cover" loading="lazy" />}
        </div>
      )}
    </Link>
  )
}
