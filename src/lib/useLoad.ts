import { useCallback, useEffect, useState } from 'react'

// 화면 이동 캐시: 같은 cacheKey로 다시 들어오면 지난 결과를 먼저 보여주고 뒤에서 새로 불러온다.
// 기록을 저장·삭제하면 clearLoadCache()로 비워서, 이후 화면이 지난 데이터를 보여주지 않게 한다.
const cache = new Map<string, unknown>()

export function clearLoadCache() {
  cache.clear()
}

// 비동기 조회 결과와 로딩·에러 상태. deps가 바뀌거나 reload()를 부르면 다시 불러온다.
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], cacheKey?: string) {
  const cached = () => (cacheKey !== undefined && cache.has(cacheKey) ? { data: cache.get(cacheKey) as T } : null)
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>(() => {
    const hit = cached()
    return { data: hit?.data ?? null, error: null, loading: !hit }
  })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    const hit = cached()
    setState((s) => (hit ? { data: hit.data, error: null, loading: false } : { ...s, loading: true, error: null }))
    load().then(
      (data) => {
        if (cacheKey !== undefined) cache.set(cacheKey, data)
        if (active) setState({ data, error: null, loading: false })
      },
      (e: unknown) => active && setState({ data: null, error: e instanceof Error ? e.message : String(e), loading: false }),
    )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
