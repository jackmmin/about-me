import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth.ts'
import { ImagePicker } from '../components/ImagePicker.tsx'
import { Markdown } from '../components/Markdown.tsx'
import { PassagePicker } from '../components/PassagePicker.tsx'
import { dangerClass, fieldClass, primaryClass, secondaryClass } from '../components/styles.ts'
import { TagInput } from '../components/TagInput.tsx'
import { PageHeader, StatusMessage } from '../components/ui.tsx'
import { deleteEntry, getEntry, listTags, saveEntry, type EntryDraft } from '../lib/entries.ts'
import { today } from '../lib/format.ts'
import { ENTRY_TYPE_LABEL, ENTRY_TYPE_PATH, type Entry, type EntryType } from '../lib/types.ts'
import { useLoad } from '../lib/useLoad.ts'

// /entries/new?type=diary|photo|meditation 또는 /entries/:id/edit
export function EntryEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data: original, error, loading } = useLoad(() => (id ? getEntry(id) : Promise.resolve(null)), [id])
  const { data: tagSuggestions } = useLoad(listTags, [])

  if (id && !original) return <StatusMessage loading={loading} error={error} empty="기록을 찾을 수 없습니다." />

  const param = params.get('type')
  const type: EntryType = original?.type ?? (param === 'photo' || param === 'meditation' ? param : 'diary')
  return <EntryForm key={original?.id ?? type} type={type} original={original} tagSuggestions={tagSuggestions ?? []} />
}

function toDraft(type: EntryType, original: Entry | null): EntryDraft {
  return {
    type,
    title: original?.title ?? '',
    content: original?.content ?? '',
    record_date: original?.record_date ?? today(),
    tags: original?.tags ?? [],
    images: (original?.images ?? []).map((image) => ({ kind: 'existing', image, caption: image.caption })),
    passages: original?.passages ?? [],
    cover: original?.coverId ?? null,
  }
}

const DIARY_MAX_IMAGES = 5
const DIARY_MAX_IMAGE_MB = 5
// DB 제약(010 마이그레이션)과 같게 맞춘다
const TITLE_MAX = 100
const CONTENT_MAX = 20000

function EntryForm({ type, original, tagSuggestions }: { type: EntryType; original: Entry | null; tagSuggestions: string[] }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [draft, setDraft] = useState(() => toDraft(type, original))
  const [preview, setPreview] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const label = ENTRY_TYPE_LABEL[type]
  const saving = progress !== null

  // 저장하지 않고 떠날 때 새로 고른 사진의 미리보기 URL 정리
  useEffect(
    () => () => {
      for (const d of draft.images) if (d.kind === 'new') URL.revokeObjectURL(d.previewUrl)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (type === 'photo' && draft.images.length === 0) return setError('사진을 한 장 이상 추가하세요.')
    if (type === 'diary' && !draft.title.trim() && !draft.content.trim()) return setError('제목이나 내용을 입력하세요.')
    if (type === 'diary' && draft.images.length > DIARY_MAX_IMAGES)
      return setError(`일기 사진은 최대 ${DIARY_MAX_IMAGES}장입니다. ${draft.images.length - DIARY_MAX_IMAGES}장을 빼 주세요.`)
    if (type === 'meditation' && draft.passages.length === 0 && !draft.content.trim())
      return setError('말씀을 추가하거나 묵상 내용을 입력하세요.')
    // 제한 전에 쓴 기록은 입력란이 자르지 않으므로 저장 때 한 번 더 확인
    if (draft.title.length > TITLE_MAX) return setError(`제목은 ${TITLE_MAX}자까지 쓸 수 있습니다.`)
    if (draft.content.length > CONTENT_MAX)
      return setError(`내용은 ${CONTENT_MAX.toLocaleString()}자까지 쓸 수 있습니다. ${(draft.content.length - CONTENT_MAX).toLocaleString()}자를 줄여 주세요.`)
    if (!session) return
    setError(null)
    setProgress('저장 중…')
    try {
      const entryId = await saveEntry(session.user.id, draft, original, setProgress)
      navigate(`/entries/${entryId}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setProgress(null)
    }
  }

  async function handleDelete() {
    if (!original || !confirm('이 기록과 사진을 모두 삭제할까요? 되돌릴 수 없습니다.')) return
    setProgress('삭제 중…')
    try {
      await deleteEntry(original)
      navigate(ENTRY_TYPE_PATH[type], { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setProgress(null)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader title={original ? `${label} 수정` : `새 ${type === 'photo' ? '앨범' : label}`} />

      <div className="flex flex-col gap-4">
        <input
          type="date"
          className={fieldClass}
          required
          value={draft.record_date}
          onChange={(e) => set('record_date', e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder={type === 'photo' ? '앨범 제목' : type === 'meditation' ? '제목 (선택)' : '제목'}
          maxLength={TITLE_MAX}
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
        />

        {type === 'photo' && (
          <ImagePicker value={draft.images} onChange={(v) => set('images', v)} cover={draft.cover} onCoverChange={(c) => set('cover', c)} />
        )}
        {type === 'meditation' && <PassagePicker value={draft.passages} onChange={(v) => set('passages', v)} />}

        <div>
          <div className="mb-1.5 flex gap-3 text-sm">
            <button type="button" className={preview ? 'text-neutral-500' : 'font-semibold'} onClick={() => setPreview(false)}>
              쓰기
            </button>
            <button type="button" className={preview ? 'font-semibold' : 'text-neutral-500'} onClick={() => setPreview(true)}>
              미리보기
            </button>
          </div>
          {preview ? (
            <div className="min-h-48 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <Markdown>{draft.content || '_내용 없음_'}</Markdown>
            </div>
          ) : (
            <textarea
              className={`${fieldClass} min-h-48 resize-y leading-relaxed`}
              placeholder={
                type === 'photo'
                  ? '앨범 설명 (마크다운 지원, 선택)'
                  : type === 'meditation'
                    ? '묵상 내용 (마크다운 지원)'
                    : '오늘의 기록 (마크다운 지원)'
              }
              maxLength={CONTENT_MAX}
              value={draft.content}
              onChange={(e) => set('content', e.target.value)}
            />
          )}
          <p className={`mt-1 text-right text-xs ${draft.content.length > CONTENT_MAX * 0.9 ? 'text-red-600 dark:text-red-400' : 'text-neutral-400'}`}>
            {draft.content.length.toLocaleString()} / {CONTENT_MAX.toLocaleString()}자
          </p>
        </div>

        {type === 'diary' && (
          <ImagePicker
            value={draft.images}
            onChange={(v) => set('images', v)}
            max={DIARY_MAX_IMAGES}
            maxMb={DIARY_MAX_IMAGE_MB}
            cover={draft.cover}
            onCoverChange={(c) => set('cover', c)}
          />
        )}

        <TagInput value={draft.tags} onChange={(v) => set('tags', v)} suggestions={tagSuggestions} />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button className={`${primaryClass} flex-1`} disabled={saving}>
            {progress ?? '저장'}
          </button>
          <button type="button" className={secondaryClass} disabled={saving} onClick={() => navigate(-1)}>
            취소
          </button>
        </div>
        {original && (
          <button type="button" className={dangerClass} disabled={saving} onClick={handleDelete}>
            이 기록 삭제
          </button>
        )}
      </div>
    </form>
  )
}
