import { useSyncExternalStore, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'

// 시각화 팔레트(검증 완료: 2계열 CVD·명도·대비 통과). 다크 모드는 다크 표면용 단계를 따로 쓴다.
const LIGHT = { series: ['#2a78d6', '#eb6834'], grid: '#e1e0d9', axis: '#898781', baseline: '#c3c2b7', surface: '#ffffff' }
const DARK = { series: ['#3987e5', '#d95926'], grid: '#2c2c2a', axis: '#898781', baseline: '#383835', surface: '#0a0a0a' }

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
function useChartColors() {
  const dark = useSyncExternalStore(
    (cb) => {
      darkQuery.addEventListener('change', cb)
      return () => darkQuery.removeEventListener('change', cb)
    },
    () => darkQuery.matches,
  )
  return dark ? DARK : LIGHT
}

export interface SeriesDef {
  key: string
  name: string
  format: (v: number) => string
}

export type ChartRow = { date: string } & Record<string, number | null | string>

const tickDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`

function ChartTooltip({ active, payload, label, series }: TooltipContentProps & { series: SeriesDef[] }) {
  if (!active || !payload?.length) return null
  const rows = series.flatMap((s) => {
    const v = payload.find((p) => p.dataKey === s.key)?.value
    return typeof v === 'number' ? [{ s, v }] : []
  })
  if (rows.length === 0) return null
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-1 text-neutral-500">{String(label)}</p>
      {rows.map(({ s, v }) => (
        <p key={s.key} className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
          {series.length > 1 && <span className="mr-1 font-normal text-neutral-500">{s.name}</span>}
          {s.format(v)}
        </p>
      ))}
    </div>
  )
}

export function ChartCard({ title, legend, children }: { title: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {legend}
      </div>
      {children}
    </div>
  )
}

// 2계열 이상일 때 범례 (색만으로 구분하지 않도록 이름을 같이 표시)
export function Legend({ series }: { series: SeriesDef[] }) {
  const colors = useChartColors()
  return (
    <div className="flex gap-3 text-xs text-neutral-600 dark:text-neutral-400">
      {series.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded" style={{ background: colors.series[i] }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}

const axisProps = (color: string) => ({
  tick: { fill: color, fontSize: 11 },
  tickLine: false,
  axisLine: false,
})

export function TrendLineChart({ data, series, domain }: { data: ChartRow[]; series: SeriesDef[]; domain?: [number, number] }) {
  const colors = useChartColors()
  const dots = data.length <= 31
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis dataKey="date" tickFormatter={tickDate} minTickGap={24} {...axisProps(colors.axis)} />
        <YAxis width={40} domain={domain ?? ['auto', 'auto']} allowDecimals={false} {...axisProps(colors.axis)} />
        <Tooltip
          content={(props) => <ChartTooltip {...props} series={series} />}
          cursor={{ stroke: colors.baseline, strokeWidth: 1 }}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.name}
            type="monotone"
            stroke={colors.series[i]}
            strokeWidth={2}
            connectNulls
            dot={dots ? { r: 4, strokeWidth: 2, stroke: colors.surface, fill: colors.series[i] } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: colors.surface }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function DailyBarChart({ data, series, average }: { data: ChartRow[]; series: SeriesDef; average?: number | null }) {
  const colors = useChartColors()
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis dataKey="date" tickFormatter={tickDate} minTickGap={24} {...axisProps(colors.axis)} />
        <YAxis width={40} allowDecimals={false} {...axisProps(colors.axis)} />
        <Tooltip content={(props) => <ChartTooltip {...props} series={[series]} />} cursor={{ fill: colors.grid, opacity: 0.5 }} />
        <Bar dataKey={series.key} name={series.name} fill={colors.series[0]} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        {average != null && (
          <ReferenceLine
            y={average}
            stroke={colors.axis}
            strokeDasharray="4 4"
            label={{ value: `평균 ${series.format(average)}`, position: 'insideTopRight', fill: colors.axis, fontSize: 11 }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
