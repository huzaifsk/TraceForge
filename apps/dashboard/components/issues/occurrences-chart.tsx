"use client"

import type { IssueDetail } from "@traceforge/event-schema"

import { TimeSeriesChart } from "@/components/charts/time-series-chart"
import { formatCompact } from "@/lib/format"

export function OccurrencesChart({ detail }: { detail: IssueDetail }) {
  return (
    <TimeSeriesChart
      kind="bar"
      label="Occurrences over time"
      data={detail.trend}
      bucketMs={detail.bucketMs}
      series={[{ key: "events", label: "Events", slot: 1 }]}
      formatValue={formatCompact}
    />
  )
}
