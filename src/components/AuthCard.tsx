import type { ReactNode } from 'react'

// 로그인·OTP 화면 공통 카드 레이아웃
export function AuthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-lg font-bold">About Me</p>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300'

export const primaryButtonClass =
  'w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900'

export const linkButtonClass = 'text-sm text-neutral-500 underline-offset-4 hover:underline'

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
}
