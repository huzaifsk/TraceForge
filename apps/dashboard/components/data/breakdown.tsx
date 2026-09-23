import { Card, CardContent, CardHeader, CardTitle } from "@pulseed/ui/components/card"

import { formatCount, formatPercent } from "@/lib/format"

/** Top values for one dimension as labelled horizontal bars. */
export function Breakdown({
  title,
  rows,
  mono,
}: {
  title: string
  rows: readonly { value: string; count: number }[]
  mono?: boolean
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data in this range.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => {
              const share = total ? row.count / total : 0
              return (
                <li key={row.value} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className={mono ? "truncate font-mono text-xs" : "truncate"}>
                      {row.value}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatPercent(share)} · {formatCount(row.count)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-chart-1"
                      style={{ width: `${Math.max(share * 100, 2)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
