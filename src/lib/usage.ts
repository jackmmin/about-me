import { supabase } from './supabase.ts'

// 무료 플랜 한도. 플랜을 바꾸면 여기만 고친다.
export const STORAGE_LIMIT = 1024 ** 3 // Supabase Storage 1GB (예전 사진)
export const R2_LIMIT = 10 * 1024 ** 3 // Cloudflare R2 10GB (새 사진)
export const DB_LIMIT = 500 * 1024 ** 2 // 데이터베이스 500MB
export const WARN_RATIO = 0.8 // 이 비율부터 경고

export interface Usage {
  myBytes: number // 내 사진 (두 저장소 합계)
  storageBytes: number // Supabase Storage, 모든 사용자 합계
  r2Bytes: number // R2, 모든 사용자 합계
  dbBytes: number
}

export async function fetchUsage(): Promise<Usage> {
  const { data, error } = await supabase
    .rpc('storage_usage')
    .single<{ my_bytes: number; storage_bytes: number; r2_bytes: number; db_bytes: number }>()
  if (error) throw error
  return { myBytes: data.my_bytes, storageBytes: data.storage_bytes, r2Bytes: data.r2_bytes, dbBytes: data.db_bytes }
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)}GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}MB`
  return `${Math.round(bytes / 1024)}KB`
}

// 한도에 가까운 항목만 경고 문구로 돌려준다
export function usageWarnings(u: Usage) {
  const items: string[] = []
  const check = (label: string, used: number, limit: number) => {
    if (used >= limit * WARN_RATIO)
      items.push(`${label} ${Math.round((used / limit) * 100)}% 사용 중 (${formatBytes(used)} / ${formatBytes(limit)})`)
  }
  check('사진 저장 공간(R2)', u.r2Bytes, R2_LIMIT)
  check('예전 사진 저장 공간(Supabase)', u.storageBytes, STORAGE_LIMIT)
  check('데이터베이스', u.dbBytes, DB_LIMIT)
  return items
}
