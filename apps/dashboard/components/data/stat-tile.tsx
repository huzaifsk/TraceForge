import { Card, CardContent, CardDescription, CardHeader } from "@traceforge/ui/components/card"
import { cn } from "@traceforge/ui/lib/utils"
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react"

import { computeDelta, formatPercent } from "@/lib/format"

import { Sparkline } from "./sparkline"

interface StatTileProps {
  label: string
  value: string
  current: number
  previous: number
  /** Whether a rising value is good (users) or bad (errors). */
  polarity: "up-is-good" | "up-is-bad"
  trend?: readonly number[]
  icon?: React.ComponentType<{ className?: string }>
}

/** KPI tile: value, change vs the previous period (icon + text, never color alone), sparkline. */
export function StatTile({
  label,
  value,
  current,
  previous,
  polarity,
  trend,
  icon: Icon,
}: StatTileProps) {
  const delta = computeDelta(current, previous)
  const good =
    delta.direction === "flat" ? null : (delta.direction === "up") === (polarity === "up-is-good")
  const DeltaIcon =
    delta.direction === "up"
      ? ArrowUpRightIcon
      : delta.direction === "down"
        ? ArrowDownRightIcon
        : MinusIcon
  const deltaText =
    delta.ratio === null
      ? delta.direction === "flat"
        ? "No change"
        : "New"
      : `${delta.ratio > 0 ? "+" : ""}${formatPercent(delta.ratio)}`

  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5" />}
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between gap-3">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {trend && trend.length > 1 && <Sparkline values={trend} className="mb-1 shrink-0" />}
        </div>
        <span
          className={cn(
            "flex items-center gap-1 truncate text-xs",
            good === null
              ? "text-muted-foreground"
              : good
                ? "text-status-good-text"
                : "text-status-critical-text"
          )}
        >
          <DeltaIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{deltaText}</span>
          <span className="truncate text-muted-foreground">vs previous period</span>
        </span>
      </CardContent>
    </Card>
  )
}
