import type { ImageDraft } from '../lib/entries.ts'
import { thumbPath } from '../lib/images.ts'
import { useSignedUrls } from '../lib/useSignedUrls.ts'
import { fieldClass, secondaryClass } from './styles.ts'

// 사진 추가(카메라/앨범), 순서 변경, 설명 입력, 삭제
export function ImagePicker({ value, onChange }: { value: ImageDraft[]; onChange: (images: ImageDraft[]) => void }) {
  const existingThumbs = value.flatMap((d) => (d.kind === 'existing' ? [thumbPath(d.image.storage_path)] : []))
  const urls = useSignedUrls(existingThumbs)

  function addFiles(files: FileList | null) {
    if (!files) return
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
        const src = d.kind === 'new' ? d.previewUrl : urls[thumbPath(d.image.storage_path)]
        return (
          <div key={d.kind === 'new' ? d.key : d.image.id} className="flex gap-3">
            <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
              {src && <img src={src} alt="" className="size-full object-cover" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input
                className={`${fieldClass} py-1.5 text-sm`}
                placeholder="사진 설명 (선택)"
                value={d.caption}
                onChange={(e) => update(i, { ...d, caption: e.target.value })}
              />
              <div className="flex gap-1 text-xs text-neutral-500">
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
                <button type="button" className="ml-auto px-2 py-1 text-red-600" onClick={() => update(i, null)}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        )
      })}
      <label className={`${secondaryClass} cursor-pointer`}>
        사진 추가
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
