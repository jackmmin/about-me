export type EntryType = 'diary' | 'photo' | 'meditation'

export interface EntryImage {
  id: string
  entry_id: string
  storage_path: string // 원본(긴 변 2000px, .webp 또는 예전 .jpg). 썸네일은 thumbPath()로 계산
  caption: string
  sort_order: number
}

// 묵상 말씀 한 구간. verses가 비어 있으면 장 전체
export interface Passage {
  book: string // BIBLE_BOOKS의 id
  chapter: number
  verses: number[]
}

export interface Entry {
  id: string
  type: EntryType
  title: string
  content: string
  record_date: string // YYYY-MM-DD
  created_at: string
  updated_at: string
  images: EntryImage[]
  tags: string[]
  passages: Passage[] // 묵상만 사용 (meta.passages)
  coverId: string | null // 대표 사진 id (meta.cover). 없으면 첫 사진
}

// 목록 썸네일로 쓸 대표 사진: 지정한 사진, 없거나 지워졌으면 첫 사진
export function entryCover(entry: Entry): EntryImage | null {
  return entry.images.find((img) => img.id === entry.coverId) ?? entry.images[0] ?? null
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  diary: '일기',
  photo: '사진',
  meditation: '묵상',
}

export const ENTRY_TYPE_PATH: Record<EntryType, string> = {
  diary: '/diary',
  photo: '/photos',
  meditation: '/meditation',
}
