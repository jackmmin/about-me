import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL = 60 * 60 * 1000 // 1시간마다 새 버전 확인

// 새 버전이 배포되면 하단에 업데이트 안내를 띄운다.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_INTERVAL)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-sm items-center gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg md:bottom-6 dark:bg-white dark:text-neutral-900">
      <span className="flex-1">새 버전이 있습니다.</span>
      <button className="font-semibold" onClick={() => void updateServiceWorker(true)}>
        업데이트
      </button>
      <button className="text-neutral-400 dark:text-neutral-500" onClick={() => setNeedRefresh(false)}>
        닫기
      </button>
    </div>
  )
}
