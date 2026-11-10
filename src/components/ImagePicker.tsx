import { imageDraftId, type ImageDraft } from '../lib/entries.ts'
import { thumbPath } from '../lib/images.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'
import { fieldClass, secondaryClass } from './styles.ts'

// 사진 추가(카메라/앨범), 순서 변경, 설명 입력, 삭제, 대표 사진(목록 썸네일) 선택
export function ImagePicker({
  value,
  onChange,
  max,
  maxMb,
  cover,
  onCoverChange,
}: {
  value: ImageDraft[]
  onChange: (images: ImageDraft[]) => void
  max?: number // 최대 장수 (없으면 제한 없음)
  maxMb?: number // 사진 한 장의 최대 용량 MB (없으면 제한 없음)
  cover: string | null // 대표 사진의 imageDraftId. null이거나 지운 사진이면 첫 사진
  onCoverChange: (id: string | null) => void
}) {
  const existingThumbs = value.flatMap((d) => (d.kind === 'existing' ? [thumbPath(d.image.storage_path)] : []))
  const urls = useSignedUrls(existingThumbs)
  const coverId = value.some((d) => imageDraftId(d) === cover) ? cover : value[0] && imageDraftId(value[0])
  const full = max !== undefined && value.length >= max

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    // 최대 장수를 넘기면 고른 사진을 하나도 넣지 않는다.
    if (max !== undefined && value.length + files.length > max) return alert(`최대 등록 개수는 ${max}개입니다.`)
    // 용량 초과 사진이 하나라도 있으면 마찬가지로 넣지 않고, 고른 순서로 몇 번째인지 알려준다.
    if (maxMb !== undefined) {
      const over = Array.from(files).flatMap((f, i) =>
        f.size > maxMb * 1024 * 1024 ? [`${i + 1}번째 사진 (${f.name}, ${(f.size / 1024 / 1024).toFixed(1)}MB)`] : [],
      )
      if (over.length > 0) return alert(`최대 ${maxMb}MB 크기만 저장할 수 있습니다.

용량 초과: ${over.join(', ')}`)
    }
    const added: ImageDraft[] = Array.from(files).map((file) => ({
      kind: 'new',
      key: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }))
    onChange([...value, ...added])
  }

  function update(index: number, next: ImageDraft | null) {
    const copy = [...value]
    if (next) copy[index] = next
    else {
      const [removed] = copy.splice(index, 1)
      if (removed.kind === 'new') URL.revokeObjectURL(removed.previewUrl)
    }
    onChange(copy)
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const copy = [...value]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    onChange(copy)
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((d, i) => {
        const id = imageDraftId(d)
        const isCover = id === coverId
        const src = d.kind === 'new' ? d.previewUrl : urls[thumbPath(d.image.storage_path)]
        return (
          <div key={id} className="flex gap-3">
            <div
              className={`relative size-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 ${
                isCover ? 'ring-2 ring-neutral-900 dark:ring-white' : ''
              }`}
            >
              {src && <img src={src} alt="" className="size-full object-cover" />}
              {isCover && (
                <span className="absolute top-1 left-1 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  대표
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input
                className={`${fieldClass} py-1.5 text-sm`}
                placeholder="사진 설명 (선택)"
                value={d.caption}
                onChange={(e) => update(i, { ...d, caption: e.target.value })}
              />
              <div className="flex flex-wrap gap-1 text-xs text-neutral-500">
                <button type="button" className="px-2 py-1 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                  ▲ 위로
                </button>
                <button
                  type="button"
                  className="px-2 py-1 disabled:opacity-30"
                  disabled={i === value.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ▼ 아래로
                </button>
                <button
                  type="button"
                  aria-pressed={isCover}
                  className={`px-2 py-1 ${isCover ? 'font-semibold text-neutral-900 dark:text-white' : ''}`}
                  onClick={() => onCoverChange(id)}
                >
                  {isCover ? '★ 대표 사진' : '☆ 대표로'}
                </button>
                <button type="button" className="ml-auto px-2 py-1 text-red-600" onClick={() => confirm('이 사진을 삭제할까요?') && update(i, null)}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        )
      })}
      {value.length > 1 && <p className="text-xs text-neutral-400">대표 사진이 목록 썸네일로 보입니다. 따로 고르지 않으면 첫 사진입니다.</p>}
      <label className={`${secondaryClass} ${full ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`} aria-disabled={full}>
        사진 추가{max !== undefined && ` (${value.length}/${max})`}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={full}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
