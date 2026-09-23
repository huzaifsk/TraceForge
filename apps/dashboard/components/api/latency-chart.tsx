"use client"

import type { EndpointDetail } from "@traceforge/event-schema"

import { TimeSeriesChart } from "@/components/charts/time-series-chart"
import { formatDuration } from "@/lib/format"

export function LatencyChart({ detail }: { detail: EndpointDetail }) {
  return (
    <TimeSeriesChart
      kind="line"
      label="Latency over time (p50 and p95)"
      data={detail.latency}
      bucketMs={detail.bucketMs}
      series={[
        { key: "p50", label: "p50", slot: 1 },
        { key: "p95", label: "p95", slot: 2 },
      ]}
      formatValue={formatDuration}
    />
  )
}
