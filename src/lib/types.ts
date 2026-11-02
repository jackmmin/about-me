export type EntryType = 'diary' | 'photo'

export interface EntryImage {
  id: string
  entry_id: string
  storage_path: string // 원본(긴 변 2000px). 썸네일은 thumbPath()로 계산
  caption: string
  sort_order: number
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
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  diary: '일기',
  photo: '사진',
}
