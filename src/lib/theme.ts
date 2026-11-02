import { useSyncExternalStore } from 'react'

// 테마 선택: 시스템 설정 따르기 / 라이트 / 다크. <html>의 'dark' 클래스로 적용한다.
// index.html의 인라인 스크립트가 첫 렌더 전에 같은 규칙으로 먼저 적용해 깜빡임을 막는다.
export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'theme'
const THEME_COLOR = { light: '#ffffff', dark: '#0a0a0a' }
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function apply() {
  const pref = getThemePref()
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light)
  for (const l of listeners) l()
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, pref)
  apply()
}

media.addEventListener('change', apply)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useThemePref() {
  return useSyncExternalStore(subscribe, getThemePref)
}

// 실제로 다크가 적용 중인지 (차트 색 선택 등에 사용)
export function useIsDark() {
  return useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'))
}
