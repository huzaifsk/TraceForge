import { vitalsSchema } from "@pulseed/event-schema"
import { rateWebVital } from "@pulseed/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pulseed/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@pulseed/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pulseed/ui/components/table"
import { cn } from "@pulseed/ui/lib/utils"
import { GaugeIcon } from "lucide-react"
import type { Metadata } from "next"

import { VitalCard } from "@/components/data/vital-card"
import { PageHeader } from "@/components/page-header"
import { VitalsFilters } from "@/components/performance/vitals-filters"
import { VitalTrend } from "@/components/performance/vital-trend"
import { apiGet } from "@/lib/api"
import { apiQuery, parseFilters } from "@/lib/filters"
import { formatCount, formatVital } from "@/lib/format"

export const metadata: Metadata = { title: "Web Vitals" }

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const TONE = {
  good: "",
  "needs-improvement": "text-status-warning-text",
  poor: "text-status-critical-text",
} as const

/** Table cell that marks non-good values with a colored value *and* a text rating for screen readers. */
function VitalCell({ name, value }: { name: "LCP" | "INP" | "CLS"; value: number | null }) {
  const rating = value === null ? null : rateWebVital(name, value)
  return (
    <TableCell className={cn("text-right tabular-nums", rating && TONE[rating])}>
      {formatVital(name, value)}
      {rating && rating !== "good" && (
        <span className="sr-only"> ({rating.replace("-", " ")})</span>
      )}
    </TableCell>
  )
}

export default async function PerformancePage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/performance">) {
  const { projectId } = await params
  const query = await searchParams
  const filters = parseFilters(query)
  const vitals = await apiGet(
    `/api/v1/projects/${projectId}/web-vitals?${apiQuery(filters, {
      route: one(query.route),
      browser: one(query.browser),
      deviceType: one(query.device),
    })}`,
    vitalsSchema
  )
  const hasData = vitals.vitals.some((v) => v.samples > 0)

  return (
    <>
      <PageHeader
        title="Web Vitals"
        description="The 75th percentile of real page loads, the standard Google uses for Core Web Vitals."
        actions={<VitalsFilters routes={vitals.facets.routes} browsers={vitals.facets.browsers} />}
      />
      {!hasData ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GaugeIcon />
            </EmptyMedia>
            <EmptyTitle>No Web Vitals yet</EmptyTitle>
            <EmptyDescription>
              Vitals are reported when a visitor leaves or hides the page. They appear here within
              seconds of that.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <section
            aria-label="Vitals"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
          >
            {vitals.vitals.map((vital) => (
              <VitalCard key={vital.name} vital={vital} />
            ))}
          </section>
          <Card>
            <CardHeader>
              <CardTitle>Trend</CardTitle>
              <CardDescription>p75 over time, with the Good and Poor thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <VitalTrend vitals={vitals} />
            </CardContent>
          </Card>
          <Card className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle>Slowest routes</CardTitle>
              <CardDescription>Ordered by p75 LCP</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Route</TableHead>
                  <TableHead className="text-right">LCP</TableHead>
                  <TableHead className="text-right">INP</TableHead>
                  <TableHead className="text-right">CLS</TableHead>
                  <TableHead className="pr-4 text-right">Page loads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vitals.routes.map((row) => (
                  <TableRow key={row.route}>
                    <TableCell className="max-w-0 truncate pl-4 font-mono text-xs">
                      {row.route}
                    </TableCell>
                    <VitalCell name="LCP" value={row.lcp} />
                    <VitalCell name="INP" value={row.inp} />
                    <VitalCell name="CLS" value={row.cls} />
                    <TableCell className="pr-4 text-right tabular-nums">
                      {formatCount(row.loads)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  )
}
