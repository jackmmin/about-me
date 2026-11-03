import { useEffect, useRef, useState } from 'react'
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme.ts'

const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'system', label: '시스템', icon: 'M4 5h16v11H4zM9 20h6M12 16v4' }, // 모니터
  {
    value: 'light',
    label: '라이트',
    icon: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', // 해
  },
  { value: 'dark', label: '다크', icon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' }, // 달
]

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

// 누르면 시스템/라이트/다크 중 하나를 고르는 메뉴가 펼쳐진다.
// placement: 사이드바 하단처럼 아래 공간이 없으면 'up'
export function ThemeToggle({ showLabel, placement = 'down' }: { showLabel?: boolean; placement?: 'up' | 'down' }) {
  const pref = useThemePref()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = OPTIONS.find((o) => o.value === pref)!

  // 바깥을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`테마: ${current.label}`}
        title={`테마: ${current.label}`}
        onClick={() => setOpen(!open)}
      >
        <Icon path={current.icon} />
        {showLabel && `테마: ${current.label}`}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="테마 선택"
          className={`absolute z-30 w-36 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 ${
            placement === 'up' ? 'bottom-full left-0 mb-1' : 'top-full right-0 mt-1'
          }`}
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={pref === o.value}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                pref === o.value ? 'font-semibold' : 'text-neutral-600 dark:text-neutral-400'
              }`}
              onClick={() => {
                setThemePref(o.value)
                setOpen(false)
              }}
            >
              <Icon path={o.icon} />
              <span className="flex-1">{o.label}</span>
              {pref === o.value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
