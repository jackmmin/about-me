import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

export function StatusMessage({ loading, error, empty }: { loading?: boolean; error?: string | null; empty?: string }) {
  const text = loading ? '불러오는 중…' : error ? `오류: ${error}` : empty
  if (!text) return null
  return (
    <div
      className={`rounded-xl border border-dashed p-10 text-center text-sm ${
        error ? 'border-red-300 text-red-600' : 'border-neutral-300 text-neutral-400 dark:border-neutral-700'
      }`}
    >
      {text}
    </div>
  )
}

export function TagChip({ name, active, onClick }: { name: string; active?: boolean; onClick?: () => void }) {
  const className = `rounded-full px-2.5 py-0.5 text-xs ${
    active
      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
  }`
  return onClick ? (
    <button type="button" className={className} onClick={onClick}>
      #{name}
    </button>
  ) : (
    <span className={className}>#{name}</span>
  )
}
