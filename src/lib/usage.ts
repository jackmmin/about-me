import { supabase } from './supabase.ts'

// 무료 플랜 한도. 플랜을 바꾸면 여기만 고친다.
export const STORAGE_LIMIT = 1024 ** 3 // Supabase Storage 1GB (예전 사진)
export const R2_LIMIT = 10 * 1024 ** 3 // Cloudflare R2 10GB (새 사진)
export const DB_LIMIT = 500 * 1024 ** 2 // 데이터베이스 500MB
export const WARN_RATIO = 0.8 // 이 비율부터 경고 (모든 사용자 합계 기준)

// total: 모든 사용자 합계, mine: 그중 내 몫
export interface Usage {
  storage: { total: number; mine: number }
  r2: { total: number; mine: number }
  // 데이터베이스는 사용자별로 정확히 나눌 수 없어서 행 데이터(rows)만 나누고 나머지는 공통(시스템·인덱스)
  db: { total: number; rows: number; mine: number }
}

interface UsageRow {
  storage_bytes: number
  storage_my_bytes: number
  r2_bytes: number
  r2_my_bytes: number
  db_bytes: number
  db_rows_bytes: number
  db_my_bytes: number
}

const CACHE_KEY = 'usage-cache'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6시간

export async function fetchUsage(): Promise<Usage> {
  const { data, error } = await supabase.rpc('storage_usage').single<UsageRow>()
  if (error) throw error
  const usage = {
    storage: { total: data.storage_bytes, mine: data.storage_my_bytes },
    r2: { total: data.r2_bytes, mine: data.r2_my_bytes },
    db: { total: data.db_bytes, rows: data.db_rows_bytes, mine: data.db_my_bytes },
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), usage }))
  return usage
}

// 상단 경고 배너용. 집계가 무겁고(모든 사용자의 파일·행을 훑는다) 사용량은 천천히 변하므로
// 6시간 안에 조회한 결과가 있으면 그대로 쓴다. 백업 화면은 fetchUsage로 매번 새로 조회한다.
export async function fetchUsageCached(): Promise<Usage> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { at: number; usage: Usage } | null
    if (cached && Date.now() - cached.at < CACHE_TTL) return cached.usage
  } catch {
    // 깨진 값이면 새로 조회
  }
  return fetchUsage()
}

export function clearUsageCache() {
  localStorage.removeItem(CACHE_KEY)
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
  check('사진 저장 공간(R2)', u.r2.total, R2_LIMIT)
  check('예전 사진 저장 공간(Supabase)', u.storage.total, STORAGE_LIMIT)
  check('데이터베이스', u.db.total, DB_LIMIT)
  return items
}
