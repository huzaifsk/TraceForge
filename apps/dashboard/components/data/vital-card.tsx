import type { VitalSummary } from "@pulseed/event-schema"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pulseed/ui/components/card"

import { formatCount, formatVital } from "@/lib/format"
import { goodThreshold, VITAL_INFO } from "@/lib/vitals"

import { DistributionBar } from "./distribution-bar"
import { RatingBadge } from "./rating-badge"

/** p75 of one vital (the Web Vitals standard percentile), its rating and the load distribution. */
export function VitalCard({ vital }: { vital: VitalSummary }) {
  const info = VITAL_INFO[vital.name]
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <abbr title={info.label} className="no-underline">
            {vital.name}
          </abbr>
        </CardTitle>
        <CardDescription className="truncate">{info.label}</CardDescription>
        <CardAction>
          <RatingBadge rating={vital.rating} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold tracking-tight">
            {formatVital(vital.name, vital.p75)}
          </span>
          <span className="text-xs text-muted-foreground">
            p75 · {formatCount(vital.samples)} {vital.samples === 1 ? "sample" : "samples"}
          </span>
        </div>
        <DistributionBar distribution={vital.distribution} />
        <p className="text-xs text-muted-foreground">{goodThreshold(vital.name)}</p>
      </CardContent>
    </Card>
  )
}
