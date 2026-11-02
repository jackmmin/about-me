import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const RELOCK_AFTER = 10 * 60 * 1000 // 백그라운드 10분 초과 시 다시 잠금
const LAST_ACTIVE_KEY = 'appLock.lastActive'

// 마지막으로 앱을 쓰던 시각. sessionStorage라 앱을 완전히 종료하면 사라진다(= 다시 열면 잠금).
// 업데이트로 화면만 새로고침된 경우에는 남아 있어서 불필요하게 다시 잠그지 않는다.
function recentlyActive() {
  const last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY))
  return last > 0 && Date.now() - last < RELOCK_AFTER
}

function markActive() {
  sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
}

// Android 앱에서만 지문(또는 기기 PIN) 잠금을 건다. 웹/PWA에서는 아무것도 하지 않는다.
export function AppLock({ children }: { children: ReactNode }) {
  const enabled = Capacitor.isNativePlatform()
  const [locked, setLocked] = useState(() => enabled && !recentlyActive())
  const [error, setError] = useState<string | null>(null)

  const unlock = useCallback(async () => {
    try {
      await BiometricAuth.authenticate({
        reason: 'About Me 잠금 해제',
        androidTitle: 'About Me',
        androidSubtitle: '지문 또는 기기 잠금으로 확인',
        allowDeviceCredential: true,
      })
      markActive()
      setError(null)
      setLocked(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증에 실패했습니다.')
    }
  }, [])

  const lockedRef = useRef(locked)
  useEffect(() => {
    lockedRef.current = locked
  }, [locked])

  useEffect(() => {
    if (!enabled) return
    // 지문 창이 떠 있는 동안에도 잠깐 비활성이 되므로, 잠금 해제 상태일 때만 시각을 기록한다.
    const leave = () => {
      if (!lockedRef.current) markActive()
    }
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) leave()
      else if (!recentlyActive()) setLocked(true)
    })
    window.addEventListener('pagehide', leave)
    return () => {
      void handle.then((h) => h.remove())
      window.removeEventListener('pagehide', leave)
    }
  }, [enabled])

  // 잠기면 바로 인증 창(네이티브)을 띄운다. state는 인증 결과가 돌아온 뒤에만 바뀐다.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (locked) void unlock()
  }, [locked, unlock])

  if (!locked) return children

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-bold">About Me</p>
        <p className="text-sm text-neutral-500">잠겨 있습니다.</p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
          onClick={() => void unlock()}
        >
          잠금 해제
        </button>
      </div>
    </div>
  )
}
