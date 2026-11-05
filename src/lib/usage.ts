import { supabase } from './supabase.ts'

// Supabase 무료 플랜 한도. 플랜을 바꾸면 여기만 고친다.
export const STORAGE_LIMIT = 1024 ** 3 // 사진 Storage 1GB
export const DB_LIMIT = 500 * 1024 ** 2 // 데이터베이스 500MB
export const WARN_RATIO = 0.8 // 이 비율부터 경고

export interface Usage {
  myBytes: number // 내 사진
  totalBytes: number // 모든 사용자 사진 합계
  dbBytes: number
}

export async function fetchUsage(): Promise<Usage> {
  const { data, error } = await supabase
    .rpc('storage_usage')
    .single<{ my_bytes: number; total_bytes: number; db_bytes: number }>()
  if (error) throw error
  return { myBytes: data.my_bytes, totalBytes: data.total_bytes, dbBytes: data.db_bytes }
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)}GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}MB`
  return `${Math.round(bytes / 1024)}KB`
}

// 한도에 가까운 항목만 경고 문구로 돌려준다
export function usageWarnings(u: Usage) {
  const items: string[] = []
  const pct = (used: number, limit: number) => Math.round((used / limit) * 100)
  if (u.totalBytes >= STORAGE_LIMIT * WARN_RATIO)
    items.push(`사진 저장 공간 ${pct(u.totalBytes, STORAGE_LIMIT)}% 사용 중 (${formatBytes(u.totalBytes)} / ${formatBytes(STORAGE_LIMIT)})`)
  if (u.dbBytes >= DB_LIMIT * WARN_RATIO)
    items.push(`데이터베이스 ${pct(u.dbBytes, DB_LIMIT)}% 사용 중 (${formatBytes(u.dbBytes)} / ${formatBytes(DB_LIMIT)})`)
  return items
}
