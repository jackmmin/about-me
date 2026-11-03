import type { ReactNode } from 'react'

export interface TabItem<K extends string> {
  key: K
  label: string
  badge?: ReactNode // 탭 이름 옆 보조 표시 (건수, 기록 여부 등)
}

// primary: 화면의 큰 구분(밑줄형) / secondary: 그 안의 작은 구분(알약형)
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  variant = 'primary',
  label,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  variant?: 'primary' | 'secondary'
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={
        variant === 'primary'
          ? 'flex border-b border-neutral-200 dark:border-neutral-800'
          : 'grid gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900'
      }
      style={variant === 'secondary' ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}
    >
      {items.map((t) => {
        const selected = t.key === value
        const className =
          variant === 'primary'
            ? `-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm ${
                selected
                  ? 'border-neutral-900 font-semibold dark:border-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`
            : `flex items-center justify-center gap-1 rounded-lg py-1.5 text-sm ${
                selected ? 'bg-white font-semibold shadow-sm dark:bg-neutral-800' : 'text-neutral-500'
              }`
        return (
          <button key={t.key} type="button" role="tab" aria-selected={selected} className={className} onClick={() => onChange(t.key)}>
            {t.label}
            {t.badge}
          </button>
        )
      })}
    </div>
  )
}
