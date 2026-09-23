import { cn } from "@traceforge/ui/lib/utils"

import { formatPercent } from "@/lib/format"

interface Distribution {
  good: number
  "needs-improvement": number
  poor: number
}

const SEGMENTS = [
  { key: "good", label: "Good", className: "bg-status-good" },
  { key: "needs-improvement", label: "Needs improvement", className: "bg-status-warning" },
  { key: "poor", label: "Poor", className: "bg-status-critical" },
] as const

/** Share of page loads per rating. The text alternative lists every segment. */
export function DistributionBar({
  distribution,
  className,
}: {
  distribution: Distribution
  className?: string
}) {
  const total = distribution.good + distribution["needs-improvement"] + distribution.poor
  const description = SEGMENTS.map(
    ({ key, label }) => `${label} ${formatPercent(total ? distribution[key] / total : 0)}`
  ).join(", ")

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="img"
        aria-label={total ? description : "No samples"}
        className="flex h-1.5 gap-0.5"
      >
        {total === 0 ? (
          <div className="h-full flex-1 rounded-full bg-muted" />
        ) : (
          SEGMENTS.filter(({ key }) => distribution[key] > 0).map(({ key, className: tone }) => (
            <div
              key={key}
              className={cn("h-full rounded-full", tone)}
              style={{ flexGrow: distribution[key], flexBasis: 0, minWidth: 4 }}
            />
          ))
        )}
      </div>
      {total > 0 && (
        <p className="flex gap-3 text-xs text-muted-foreground tabular-nums" aria-hidden="true">
          {SEGMENTS.map(({ key }) => (
            <span key={key}>{formatPercent(distribution[key] / total)}</span>
          ))}
        </p>
      )}
    </div>
  )
}
