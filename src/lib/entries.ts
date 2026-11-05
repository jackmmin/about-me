import { removeImages, uploadImage } from './images.ts'
import { supabase } from './supabase.ts'
import type { Entry, EntryImage, EntryType, Passage } from './types.ts'

const SELECT = 'id, type, title, content, record_date, created_at, updated_at, meta, entry_images(*), entry_tags(tags(name))'

interface EntryRow extends Omit<Entry, 'images' | 'tags' | 'passages'> {
  meta: { passages?: Passage[]; cover?: string } | null
  entry_images: EntryImage[]
  entry_tags: { tags: { name: string } | null }[]
}

function toEntry(row: EntryRow): Entry {
  const { meta, entry_images, entry_tags, ...rest } = row
  return {
    ...rest,
    passages: meta?.passages ?? [],
    coverId: meta?.cover ?? null,
    images: [...entry_images].sort((a, b) => a.sort_order - b.sort_order),
    tags: entry_tags.flatMap((t) => (t.tags ? [t.tags.name] : [])).sort(),
  }
}

export async function listEntries({
  type,
  from,
  limit = 50,
  offset = 0,
}: { type?: EntryType; from?: string; limit?: number; offset?: number } = {}) {
  let query = supabase
    .from('entries')
    .select(SELECT)
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (type) query = query.eq('type', type)
  if (from) query = query.gte('record_date', from)
  const { data, error } = await query
  if (error) throw error
  return (data as unknown as EntryRow[]).map(toEntry)
}

export async function getEntry(id: string) {
  const { data, error } = await supabase.from('entries').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toEntry(data as unknown as EntryRow) : null
}

export async function listTags() {
  const { data, error } = await supabase.from('tags').select('name').order('name')
  if (error) throw error
  return data.map((t) => t.name as string)
}

// 편집 화면의 사진 한 장: 이미 저장된 사진이거나 새로 고른 파일
// 새 사진의 key는 저장할 때 entry_images.id로 그대로 쓴다 (대표 사진을 업로드 전에 지정하기 위해).
export type ImageDraft =
  | { kind: 'existing'; image: EntryImage; caption: string }
  | { kind: 'new'; key: string; file: File; previewUrl: string; caption: string }

export const imageDraftId = (d: ImageDraft) => (d.kind === 'new' ? d.key : d.image.id)

export interface EntryDraft {
  type: EntryType
  title: string
  content: string
  record_date: string
  tags: string[]
  images: ImageDraft[]
  passages: Passage[]
  cover: string | null // 대표 사진의 imageDraftId. null이면 첫 사진
}

// 기록 저장: 본문 → 태그 → 사진(삭제, 순서·설명 갱신, 새 업로드) 순서로 반영한다.
export async function saveEntry(
  userId: string,
  draft: EntryDraft,
  original: Entry | null,
  onProgress?: (message: string) => void,
) {
  const fields = {
    type: draft.type,
    title: draft.title,
    content: draft.content,
    record_date: draft.record_date,
    meta: draft.type === 'meditation' ? { passages: draft.passages } : coverMeta(draft),
  }
  const { data, error } = original
    ? await supabase.from('entries').update(fields).eq('id', original.id).select('id').single()
    : await supabase.from('entries').insert(fields).select('id').single()
  if (error) throw error
  const entryId = data.id as string

  await syncTags(entryId, draft.tags)

  // 빠진 사진 삭제
  const keptIds = new Set(draft.images.flatMap((d) => (d.kind === 'existing' ? [d.image.id] : [])))
  const removed = (original?.images ?? []).filter((img) => !keptIds.has(img.id))
  if (removed.length > 0) {
    const { error } = await supabase.from('entry_images').delete().in('id', removed.map((img) => img.id))
    if (error) throw error
    await removeImages(removed.map((img) => img.storage_path))
  }

  const newCount = draft.images.filter((d) => d.kind === 'new').length
  let uploaded = 0
  for (const [index, d] of draft.images.entries()) {
    if (d.kind === 'existing') {
      if (d.image.sort_order !== index || d.image.caption !== d.caption) {
        const { error } = await supabase
          .from('entry_images')
          .update({ sort_order: index, caption: d.caption })
          .eq('id', d.image.id)
        if (error) throw error
      }
    } else {
      onProgress?.(`사진 업로드 중 (${++uploaded}/${newCount})`)
      const { path, size } = await uploadImage(userId, entryId, d.key, d.file)
      const { error } = await supabase
        .from('entry_images')
        .insert({ id: d.key, entry_id: entryId, storage_path: path, size_bytes: size, caption: d.caption, sort_order: index })
      if (error) {
        await removeImages([path])
        throw error
      }
    }
  }
  return entryId
}

// 대표 사진이 남아 있는 사진 중에 있을 때만 저장한다.
function coverMeta(draft: EntryDraft) {
  return draft.cover && draft.images.some((d) => imageDraftId(d) === draft.cover) ? { cover: draft.cover } : {}
}

// 기록의 태그를 names로 맞춘다 (없는 태그는 만든다). 복원에서도 쓴다.
export async function syncTags(entryId: string, names: string[]) {
  const { error: deleteError } = await supabase.from('entry_tags').delete().eq('entry_id', entryId)
  if (deleteError) throw deleteError
  if (names.length === 0) return

  const { data: tags, error } = await supabase
    .from('tags')
    .upsert(names.map((name) => ({ name })), { onConflict: 'user_id,name' })
    .select('id')
  if (error) throw error
  const { error: linkError } = await supabase
    .from('entry_tags')
    .insert(tags.map((t) => ({ entry_id: entryId, tag_id: t.id })))
  if (linkError) throw linkError
}

// 기록과 사진 파일을 함께 지운다. (entry_images, entry_tags 행은 FK cascade로 삭제)
export async function deleteEntry(entry: Entry) {
  const { error } = await supabase.from('entries').delete().eq('id', entry.id)
  if (error) throw error
  await removeImages(entry.images.map((img) => img.storage_path))
}

// PostgREST or() 필터 문법을 깨뜨리는 문자를 걸러낸다.
export function sanitizeQuery(q: string) {
  return q.replace(/[,()%*\\:"]/g, ' ').replace(/\s+/g, ' ').trim()
}

// 제목·본문·태그에서 검색 (최근 기록 순)
export async function searchEntries(q: string, limit = 50) {
  const term = sanitizeQuery(q)
  if (!term) return []
  const pattern = `%${term}%`

  const { data: tagRows, error: tagError } = await supabase.from('tags').select('entry_tags(entry_id)').ilike('name', pattern)
  if (tagError) throw tagError
  const taggedIds = [...new Set(tagRows.flatMap((t) => (t.entry_tags as { entry_id: string }[]).map((et) => et.entry_id)))]

  const filters = [`title.ilike.${pattern}`, `content.ilike.${pattern}`]
  if (taggedIds.length > 0) filters.push(`id.in.(${taggedIds.join(',')})`)

  const { data, error } = await supabase
    .from('entries')
    .select(SELECT)
    .or(filters.join(','))
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as unknown as EntryRow[]).map(toEntry)
}
