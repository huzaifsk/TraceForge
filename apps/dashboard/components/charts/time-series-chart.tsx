"use client"

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@traceforge/ui/components/chart"
import { cn } from "@traceforge/ui/lib/utils"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import { formatBucket, formatDateTime } from "@/lib/format"

export interface Series {
  key: string
  label: string
  /** Categorical slot 1–5, assigned in fixed order per entity (never by rank). */
  slot: 1 | 2 | 3 | 4 | 5
}

export interface Threshold {
  value: number
  label: string
}

interface TimeSeriesChartProps {
  data: ReadonlyArray<{ t: number } & Record<string, number | null>>
  series: readonly Series[]
  kind: "area" | "line" | "bar"
  bucketMs: number
  label: string
  formatValue: (value: number) => string
  thresholds?: readonly Threshold[]
  className?: string
}

/**
 * One chart component for every time series in the dashboard, so all charts
 * share mark specs: 2px lines, ~12% area fill, rounded bar ends, horizontal
 * grid only, crosshair tooltip, a legend for 2+ series, and a hidden data table.
 */
export function TimeSeriesChart({
  data,
  series,
  kind,
  bucketMs,
  label,
  formatValue,
  thresholds = [],
  className,
}: TimeSeriesChartProps) {
  const config = Object.fromEntries(
    series.map(({ key, label: name, slot }) => [
      key,
      { label: name, color: `var(--chart-${slot})` },
    ])
  ) satisfies ChartConfig

  const Chart = kind === "area" ? AreaChart : kind === "line" ? LineChart : BarChart
  const shared = [
    <CartesianGrid key="grid" vertical={false} stroke="var(--chart-grid)" />,
    <XAxis
      key="x"
      dataKey="t"
      tickLine={false}
      axisLine={{ stroke: "var(--chart-axis)" }}
      tickMargin={8}
      minTickGap={32}
      tickFormatter={(t: number) => formatBucket(t, bucketMs)}
    />,
    <YAxis
      key="y"
      tickLine={false}
      axisLine={false}
      width={56}
      tickMargin={4}
      allowDecimals={false}
      tickFormatter={(value: number) => formatValue(value)}
    />,
    <ChartTooltip
      key="tooltip"
      cursor={kind === "bar" ? { fill: "var(--muted)" } : { stroke: "var(--chart-axis)" }}
      content={
        <ChartTooltipContent
          indicator={kind === "bar" ? "dot" : "line"}
          labelFormatter={(_, payload) => {
            const t = payload?.[0]?.payload?.t as number | undefined
            return t === undefined ? "" : formatDateTime(t)
          }}
          formatter={(value, name) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {typeof value === "number" ? formatValue(value) : "—"}
              </span>
            </div>
          )}
        />
      }
    />,
    ...thresholds.map((threshold) => (
      <ReferenceLine
        key={`threshold-${threshold.value}`}
        y={threshold.value}
        stroke="var(--chart-axis)"
        strokeDasharray="4 4"
        label={{
          value: threshold.label,
          position: "insideTopRight",
          fill: "var(--muted-foreground)",
          fontSize: 11,
        }}
      />
    )),
    ...(series.length > 1 ? [<ChartLegend key="legend" content={<ChartLegendContent />} />] : []),
  ]

  return (
    <figure className={cn("flex flex-col", className)}>
      <ChartContainer
        config={config}
        className="aspect-auto h-64 w-full"
        aria-label={label}
        role="img"
      >
        <Chart
          data={[...data]}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap={2}
        >
          {shared}
          {series.map(({ key }) =>
            kind === "area" ? (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                fill={`var(--color-${key})`}
                fillOpacity={0.12}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : kind === "line" ? (
              <Line
                key={key}
                dataKey={key}
                type="monotone"
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : (
              <Bar
                key={key}
                dataKey={key}
                fill={`var(--color-${key})`}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            )
          )}
        </Chart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.t}>
              <th scope="row">{formatDateTime(point.t)}</th>
              {series.map((s) => (
                <td key={s.key}>{point[s.key] == null ? "No data" : formatValue(point[s.key]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
