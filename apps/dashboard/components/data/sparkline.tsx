import { cn } from "@pulseed/ui/lib/utils"

/**
 * Tiny trend line (no axes). Decorative: the number beside it carries the
 * meaning, so it is hidden from assistive technology.
 */
export function Sparkline({
  values,
  className,
  variant = "line",
}: {
  values: readonly number[]
  className?: string
  variant?: "line" | "bars"
}) {
  const width = 96
  const height = 24
  const max = Math.max(...values, 0)
  const n = values.length

  if (variant === "bars") {
    const gap = 1
    const barWidth = n > 0 ? (width - gap * (n - 1)) / n : 0
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className={cn("h-6 w-24 text-chart-1", className)}
      >
        {values.map((value, i) => {
          const h = max > 0 ? Math.max(value > 0 ? 2 : 1, (value / max) * height) : 1
          return (
            <rect
              key={i}
              x={i * (barWidth + gap)}
              y={height - h}
              width={barWidth}
              height={h}
              rx={Math.min(1, barWidth / 2)}
              className={value > 0 ? "fill-current" : "fill-muted"}
            />
          )
        })}
      </svg>
    )
  }

  const points = values.map((value, i) => {
    const x = n > 1 ? (i / (n - 1)) * width : width / 2
    const y = max > 0 ? height - 2 - (value / max) * (height - 4) : height - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-6 w-24 text-chart-1", className)}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
