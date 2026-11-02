import type { ReactNode } from 'react'

// 접고 펼 수 있는 입력 섹션
export function Section({ title, summary, defaultOpen, children }: { title: string; summary?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-neutral-200 dark:border-neutral-800">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
        <span className="font-semibold">{title}</span>
        <span className="flex items-center gap-2 text-sm text-neutral-500">
          {summary}
          <span className="transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-neutral-200 px-4 py-4 dark:border-neutral-800">{children}</div>
    </details>
  )
}
