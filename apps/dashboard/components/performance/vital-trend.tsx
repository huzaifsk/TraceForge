"use client"

import type { Vitals } from "@pulseed/event-schema"
import { Tabs, TabsList, TabsTrigger } from "@pulseed/ui/components/tabs"
import { useState } from "react"

import { TimeSeriesChart } from "@/components/charts/time-series-chart"
import { formatVital } from "@/lib/format"
import { thresholdsFor, VITAL_INFO } from "@/lib/vitals"

/** One vital at a time: different units never share an axis. */
export function VitalTrend({ vitals }: { vitals: Vitals }) {
  const [selected, setSelected] = useState<Vitals["vitals"][number]["name"]>("LCP")
  const vital = vitals.vitals.find((v) => v.name === selected) ?? vitals.vitals[0]!
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={selected} onValueChange={(value) => setSelected(value as typeof selected)}>
        <TabsList>
          {vitals.vitals.map((v) => (
            <TabsTrigger key={v.name} value={v.name}>
              {v.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <TimeSeriesChart
        kind="line"
        label={`${VITAL_INFO[vital.name].label} p75 over time`}
        data={vital.trend}
        bucketMs={vitals.bucketMs}
        series={[{ key: "p75", label: `${vital.name} p75`, slot: 1 }]}
        formatValue={(value) => formatVital(vital.name, value)}
        thresholds={thresholdsFor(vital.name)}
      />
    </div>
  )
}
