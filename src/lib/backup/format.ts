// 백업 파일(ZIP) 형식. 구조를 바꾸면 BACKUP_VERSION을 올리고 읽는 쪽에서 이전 버전도 처리한다.
//
// backup-YYYY-MM-DD.zip
// ├─ manifest.json
// ├─ diary/entries.json, diary/images/{기록id}/{사진id}.webp (예전 사진은 .jpg)
// ├─ photos/entries.json, photos/images/...
// ├─ meditation/entries.json
// └─ health/meals.json, health/exercises.json
//
// 모든 기록은 원래 id를 그대로 담는다. 복원할 때 같은 id가 이미 있으면 건너뛴다.
// user_id와 Storage 경로는 담지 않고, 복원할 때 현재 계정 기준으로 다시 만든다.

export const BACKUP_FORMAT = 'about-me-backup'
export const BACKUP_VERSION = 1

export type BackupCategory = 'diary' | 'photo' | 'meditation' | 'health'

export const CATEGORIES: { key: BackupCategory; label: string; folder: string }[] = [
  { key: 'diary', label: '일기', folder: 'diary' },
  { key: 'photo', label: '사진', folder: 'photos' },
  { key: 'meditation', label: '묵상', folder: 'meditation' },
  { key: 'health', label: '건강', folder: 'health' },
]

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<BackupCategory, string>
export const CATEGORY_FOLDER = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.folder])) as Record<BackupCategory, string>

export interface BackupManifest {
  format: typeof BACKUP_FORMAT
  version: number
  exported_at: string
  categories: BackupCategory[]
  counts: Partial<Record<BackupCategory, { records: number; images: number }>>
}

export interface BackupImage {
  id: string
  file: string // 카테고리 폴더 기준 상대 경로 (images/{기록id}/{사진id}.webp 또는 .jpg)
  caption: string
  sort_order: number
  created_at: string
}

export interface BackupEntry {
  id: string
  type: 'diary' | 'photo' | 'meditation'
  title: string
  content: string
  record_date: string
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
  tags: string[]
  images: BackupImage[]
}

export interface BackupMeal {
  id: string
  log_date: string
  meal: string
  foods: string[]
  symptoms: string[]
  severity: number | null
  note: string
  created_at: string
  updated_at: string
}

export interface BackupExercise {
  id: string
  log_date: string
  kind: string
  minutes: number
  intensity: number | null
  memo: string
  created_at: string
}

export function entriesPath(category: Exclude<BackupCategory, 'health'>) {
  return `${CATEGORY_FOLDER[category]}/entries.json`
}
export const MEALS_PATH = 'health/meals.json'
export const EXERCISES_PATH = 'health/exercises.json'
export const MANIFEST_PATH = 'manifest.json'

export function backupFileName(date = new Date()) {
  return `backup-${date.toLocaleDateString('sv-SE')}.zip`
}
