"use client"

import type { Overview } from "@pulseed/event-schema"

import { TimeSeriesChart } from "@/components/charts/time-series-chart"
import { formatCompact } from "@/lib/format"

export function ErrorTrend({ overview }: { overview: Overview }) {
  return (
    <TimeSeriesChart
      kind="area"
      label="Errors and unhandled rejections over time"
      data={overview.trend}
      bucketMs={overview.bucketMs}
      series={[
        { key: "errors", label: "Errors", slot: 1 },
        { key: "rejections", label: "Unhandled rejections", slot: 2 },
      ]}
      formatValue={formatCompact}
    />
  )
}
