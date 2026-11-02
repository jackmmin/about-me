import { useEffect, useState } from 'react'
import { signedUrls } from './images.ts'

// 비공개 버킷 경로 목록 → 서명 URL 맵 (한 번에 묶어서 발급)
export function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = paths.join('|')

  useEffect(() => {
    if (!key) return
    let active = true
    signedUrls(key.split('|')).then(
      (result) => active && setUrls(result),
      () => active && setUrls({}),
    )
    return () => {
      active = false
    }
  }, [key])

  return urls
}
