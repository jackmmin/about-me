import { setThemePref, useThemePref, type ThemePref } from '../lib/theme.ts'

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemePref, string> = { system: '시스템', light: '라이트', dark: '다크' }
const ICON: Record<ThemePref, string> = {
  system: 'M4 5h16v11H4zM9 20h6M12 16v4', // 모니터
  light: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', // 해
  dark: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', // 달
}

// 누를 때마다 시스템 → 라이트 → 다크 순서로 바뀐다.
export function ThemeToggle({ showLabel }: { showLabel?: boolean }) {
  const pref = useThemePref()
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
      onClick={() => setThemePref(NEXT[pref])}
      aria-label={`테마: ${LABEL[pref]} (눌러서 변경)`}
      title={`테마: ${LABEL[pref]}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d={ICON[pref]} />
      </svg>
      {showLabel && `테마: ${LABEL[pref]}`}
    </button>
  )
}
