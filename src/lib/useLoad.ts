import { useCallback, useEffect, useState } from 'react'

// 비동기 조회 결과와 로딩·에러 상태. deps가 바뀌거나 reload()를 부르면 다시 불러온다.
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, loading: true, error: null }))
    load().then(
      (data) => active && setState({ data, error: null, loading: false }),
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
