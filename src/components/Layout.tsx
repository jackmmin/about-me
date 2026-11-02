import { NavLink, Outlet } from 'react-router'
import { SECTIONS } from '../sections.ts'
import { SectionIcon } from './SectionIcon.tsx'

// PC(md 이상): 왼쪽 사이드바 / 모바일: 하단 탭바
export function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-r md:border-neutral-200 md:px-3 md:py-6 dark:md:border-neutral-800">
        <p className="mb-6 px-3 text-lg font-bold">About Me</p>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.key}
              to={s.path}
              end={s.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-neutral-100 font-semibold dark:bg-neutral-800'
                    : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900'
                }`
              }
            >
              <SectionIcon section={s.key} className="size-5" />
              {s.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/90">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.key}
            to={s.path}
            end={s.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                isActive ? 'font-semibold text-neutral-900 dark:text-white' : 'text-neutral-500'
              }`
            }
          >
            <SectionIcon section={s.key} className="size-6" />
            {s.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
