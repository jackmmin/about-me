import type { ReactNode } from 'react'
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
import { shortDate } from '../lib/format.ts'
import { useIsDark } from '../lib/theme.ts'

// 시각화 팔레트(검증 완료: 2계열 CVD·명도·대비 통과). 다크 모드는 다크 표면용 단계를 따로 쓴다.
const LIGHT = { series: ['#2a78d6', '#eb6834'], grid: '#e1e0d9', axis: '#898781', baseline: '#c3c2b7', surface: '#ffffff' }
const DARK = { series: ['#3987e5', '#d95926'], grid: '#2c2c2a', axis: '#898781', baseline: '#383835', surface: '#0a0a0a' }

// 선택한 테마(시스템/라이트/다크)를 따른다
function useChartColors() {
  return useIsDark() ? DARK : LIGHT
}

export interface SeriesDef {
  key: string
  name: string
  format: (v: number) => string
}

export type ChartRow = { date: string } & Record<string, number | null | string>

function ChartTooltip({
  active,
  payload,
  label,
  series,
  labelFormat = String,
}: TooltipContentProps & { series: SeriesDef[]; labelFormat?: (label: string) => string }) {
  if (!active || !payload?.length) return null
  const rows = series.flatMap((s) => {
    const v = payload.find((p) => p.dataKey === s.key)?.value
    return typeof v === 'number' ? [{ s, v }] : []
  })
  if (rows.length === 0) return null
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-1 text-neutral-500">{labelFormat(String(label))}</p>
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

const axisProps = (color: string) => ({
  tick: { fill: color, fontSize: 11 },
  tickLine: false,
  axisLine: false,
})

export function DailyBarChart({
  data,
  series,
  average,
  tickFormat = shortDate,
  labelFormat,
}: {
  data: ChartRow[]
  series: SeriesDef
  average?: number | null
  tickFormat?: (date: string) => string
  labelFormat?: (date: string) => string
}) {
  const colors = useChartColors()
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis dataKey="date" tickFormatter={tickFormat} minTickGap={24} {...axisProps(colors.axis)} />
        <YAxis width={40} allowDecimals={false} {...axisProps(colors.axis)} />
        <Tooltip
          content={(props) => <ChartTooltip {...props} series={[series]} labelFormat={labelFormat} />}
          cursor={{ fill: colors.grid, opacity: 0.5 }}
        />
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

// 시간에 따른 값의 추이 (선 하나). 값이 없는 구간은 건너뛰고 이어 그린다.
export function TrendLineChart({
  data,
  series,
  domain,
  ticks,
  yTickFormat,
  tickFormat = shortDate,
  labelFormat,
}: {
  data: ChartRow[]
  series: SeriesDef
  domain: [number, number]
  ticks?: number[]
  yTickFormat?: (v: number) => string
  tickFormat?: (date: string) => string
  labelFormat?: (date: string) => string
}) {
  const colors = useChartColors()
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis dataKey="date" tickFormatter={tickFormat} minTickGap={24} {...axisProps(colors.axis)} />
        <YAxis width={40} domain={domain} ticks={ticks} tickFormatter={yTickFormat} {...axisProps(colors.axis)} />
        <Tooltip
          content={(props) => <ChartTooltip {...props} series={[series]} labelFormat={labelFormat} />}
          cursor={{ stroke: colors.axis, strokeDasharray: '4 4' }}
        />
        <Line
          dataKey={series.key}
          name={series.name}
          stroke={colors.series[0]}
          strokeWidth={2}
          dot={{ r: 4, fill: colors.series[0], stroke: colors.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: colors.series[0], stroke: colors.surface, strokeWidth: 2 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export interface CategoryRow {
  label: string
  value: number
  note?: string // 값 옆에 붙는 보조 설명 (예: 평균 기분)
}

// 항목별 크기 비교 (가로 막대). 큰 순으로 정렬해 넘긴다. 값은 막대 끝에 글자로 붙인다.
export function CategoryBars({ rows, format }: { rows: CategoryRow[]; format: (v: number) => string }) {
  const colors = useChartColors()
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[6rem_1fr] items-center gap-2"
          title={`${r.label}: ${format(r.value)}${r.note ? ` · ${r.note}` : ''}`}
        >
          <span className="truncate text-neutral-600 dark:text-neutral-300">{r.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-3.5 shrink-0 rounded-r"
              style={{ width: `${(r.value / max) * 65}%`, minWidth: 2, background: colors.series[0] }}
            />
            <span className="shrink-0 text-xs tabular-nums text-neutral-500">
              {format(r.value)}
              {r.note && <span className="ml-1.5">{r.note}</span>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
