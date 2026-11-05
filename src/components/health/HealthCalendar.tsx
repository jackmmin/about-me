import { formatDate, monthDays, today } from '../../lib/format.ts'
import { listHealthRange } from '../../lib/health.ts'
import { useLoad } from '../../lib/useLoad.ts'
import { MonthGrid } from '../MonthGrid.tsx'

interface DaySummary {
  meals: number // 기록한 끼니 수 (간식 포함)
  symptoms: number // 증상이 있던 끼니 수
  minutes: number // 운동 시간 합계
}

// 건강 월 달력: 날짜마다 끼니 수(점), 증상(!), 운동 시간. 날짜를 누르면 onPick으로 그날 기록 화면을 연다.
export function HealthCalendar({ month, onMonth, onPick }: { month: string; onMonth: (month: string) => void; onPick: (date: string) => void }) {
  const days = monthDays(month)
  const from = days[0]
  const to = days[days.length - 1]
  const { data, error, loading } = useLoad(() => listHealthRange(from, to), [month], `health-calendar:${month}`)

  const byDate = new Map<string, DaySummary>()
  const summary = (date: string) => {
    let s = byDate.get(date)
    if (!s) byDate.set(date, (s = { meals: 0, symptoms: 0, minutes: 0 }))
    return s
  }
  for (const m of data?.meals ?? []) {
    const s = summary(m.log_date)
    s.meals++
    if (m.symptoms.length > 0) s.symptoms++
  }
  for (const e of data?.exercises ?? []) summary(e.log_date).minutes += e.minutes

  const totals = [...byDate.values()].reduce(
    (t, s) => ({ meals: t.meals + s.meals, symptoms: t.symptoms + s.symptoms, minutes: t.minutes + s.minutes }),
    { meals: 0, symptoms: 0, minutes: 0 },
  )
  const now = today()

  return (
    <div className="flex flex-col gap-4">
      <MonthGrid
        month={month}
        loading={loading}
        error={error}
        disableFuture
        onMonth={onMonth}
        onToday={() => onMonth(now.slice(0, 7))}
        onSelect={onPick}
        cellLabel={(d) => {
          const s = byDate.get(d)
          if (!s) return formatDate(d)
          return [
            formatDate(d),
            s.meals > 0 && `식단 ${s.meals}건`,
            s.symptoms > 0 && `증상 ${s.symptoms}건`,
            s.minutes > 0 && `운동 ${s.minutes}분`,
          ]
            .filter(Boolean)
            .join(', ')
        }}
        renderCell={(d) => {
          const s = byDate.get(d)
          if (!s) return null
          return (
            <>
              <span className="mt-1 flex h-1.5 items-center gap-0.5">
                {Array.from({ length: Math.min(s.meals, 4) }, (_, i) => (
                  <span key={i} className="size-1.5 rounded-full bg-current opacity-60" />
                ))}
                {s.symptoms > 0 && <span className="ml-0.5 text-[10px] font-bold leading-none">!</span>}
              </span>
              {s.minutes > 0 && <span className="mt-1 text-[10px] leading-none tabular-nums opacity-80">{s.minutes}분</span>}
            </>
          )
        }}
      />

      <p className="text-xs text-neutral-500">● 기록한 끼니 · ! 증상 있던 날 · 분 운동 시간 — 날짜를 누르면 그날 기록으로 이동합니다.</p>

      {byDate.size > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Tile label="기록한 날" value={`${byDate.size}일`} />
          <Tile label="총 운동" value={`${totals.minutes}분`} />
          <Tile label="증상 있던 끼니" value={`${totals.symptoms}끼`} />
        </div>
      )}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}
