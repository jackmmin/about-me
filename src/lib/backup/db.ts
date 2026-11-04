import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../supabase.ts'

const PAGE = 1000 // Supabase가 한 번에 돌려주는 최대 행 수

// 페이지를 넘기며 전부 받는다. page(from, to)는 정렬이 고정된 쿼리여야 한다.
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return rows
  }
}

// ids 중 이미 DB에 있는 것. (주소 길이 제한 때문에 나눠서 조회)
export async function existingIds(table: 'entries' | 'meal_logs' | 'exercise_logs', ids: string[]) {
  const found = new Set<string>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from(table).select('id').in('id', ids.slice(i, i + 150))
    if (error) throw error
    for (const row of data) found.add(row.id as string)
  }
  return found
}
