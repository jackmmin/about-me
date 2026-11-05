import type { ReactNode } from 'react'
import { formatMonth, monthDays, shiftMonth, today } from '../lib/format.ts'
import { StatusMessage } from './ui.tsx'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 월 달력 틀: 달 이동 헤더 + 요일 + 날짜 칸. 칸 안의 내용(renderCell)과 접근성 이름(cellLabel)은 쓰는 쪽이 정한다.
// onToday: '오늘' 버튼을 누르면 이번 달과 오늘 날짜로 옮긴다. disableFuture: 오늘 이후 날짜는 누를 수 없게 한다.
export function MonthGrid({
  month,
  selected,
  loading,
  error,
  disableFuture,
  onMonth,
  onToday,
  onSelect,
  renderCell,
  cellLabel,
}: {
  month: string
  selected?: string | null
  loading?: boolean
  error?: string | null
  disableFuture?: boolean
  onMonth: (month: string) => void
  onToday: () => void
  onSelect: (date: string) => void
  renderCell: (date: string) => ReactNode
  cellLabel: (date: string) => string
}) {
  const now = today()
  const days = monthDays(month)
  const lead = new Date(`${days[0]}T00:00:00Z`).getUTCDay()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" className="rounded-lg px-3 py-1.5 text-lg" aria-label="이전 달" onClick={() => onMonth(shiftMonth(month, -1))}>
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{formatMonth(days[0])}</h2>
          {month !== now.slice(0, 7) && (
            <button type="button" className="text-xs text-neutral-500 underline-offset-4 hover:underline" onClick={onToday}>
              오늘
            </button>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-lg disabled:opacity-30"
          aria-label="다음 달"
          disabled={disableFuture && month >= now.slice(0, 7)}
          onClick={() => onMonth(shiftMonth(month, 1))}
        >
          ›
        </button>
      </div>

      {error ? (
        <StatusMessage error={error} />
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center" aria-busy={loading}>
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={`pb-1 text-xs ${i === 0 ? 'text-red-500' : 'text-neutral-500'}`}>
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {days.map((d) => {
            const isSelected = d === selected
            return (
              <button
                key={d}
                type="button"
                aria-pressed={isSelected}
                aria-label={cellLabel(d)}
                disabled={disableFuture && d > now}
                className={`flex aspect-square flex-col items-center justify-start rounded-lg pt-1 text-xs disabled:cursor-default ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
                } ${d === now && !isSelected ? 'ring-1 ring-neutral-400' : ''} ${d > now ? 'opacity-50' : ''}`}
                onClick={() => onSelect(d)}
              >
                <span>{Number(d.slice(8))}</span>
                {renderCell(d)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
