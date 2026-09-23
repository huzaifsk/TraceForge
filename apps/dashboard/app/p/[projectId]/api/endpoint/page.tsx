import { endpointDetailSchema } from "@traceforge/event-schema"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@traceforge/ui/components/table"
import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { LatencyChart } from "@/components/api/latency-chart"
import { Breakdown } from "@/components/data/breakdown"
import { MethodBadge } from "@/components/data/method-badge"
import { RelativeTime } from "@/components/data/relative-time"
import { apiGet } from "@/lib/api"
import { apiQuery, parseFilters, withFilters } from "@/lib/filters"
import { formatCount, formatDuration, formatPercent } from "@/lib/format"

export const metadata: Metadata = { title: "Endpoint" }

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{children}</dd>
    </div>
  )
}

export default async function EndpointPage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/api/endpoint">) {
  const { projectId } = await params
  const query = await searchParams
  const method = one(query.method)
  const endpoint = one(query.endpoint)
  if (!method || !endpoint) notFound()

  const detail = await apiGet(
    `/api/v1/projects/${projectId}/api-endpoints/detail?${apiQuery(parseFilters(query), { method, endpoint })}`,
    endpointDetailSchema
  )
  const statuses = Object.entries(detail.statuses)
    .filter(([, count]) => count > 0)
    .map(([value, count]) => ({ value: value === "network" ? "No response" : value, count }))

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href={withFilters(`/p/${projectId}/api`, query)}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          API performance
        </Link>
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight">
          <MethodBadge method={detail.method} />
          <span className="truncate font-mono">{detail.endpoint}</span>
        </h1>
      </div>

      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Requests">{formatCount(detail.requests)}</Stat>
            <Stat label="Error rate">{formatPercent(detail.errorRate)}</Stat>
            <Stat label="Avg latency">{formatDuration(detail.avg)}</Stat>
            <Stat label="P95 latency">{formatDuration(detail.p95)}</Stat>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Latency</CardTitle>
            <CardDescription>Median and 95th percentile</CardDescription>
          </CardHeader>
          <CardContent>
            <LatencyChart detail={detail} />
          </CardContent>
        </Card>
        <Breakdown title="Status codes" rows={statuses} />
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Recent failures</CardTitle>
          <CardDescription>The last 20 failed requests</CardDescription>
        </CardHeader>
        {detail.recentFailures.length === 0 ? (
          <CardContent className="pb-4 text-sm text-muted-foreground">
            No failures in this range.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="hidden sm:table-cell">Browser</TableHead>
                <TableHead className="hidden pr-4 md:table-cell">Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.recentFailures.map((failure) => (
                <TableRow key={failure.id}>
                  <TableCell className="pl-4 text-muted-foreground">
                    <RelativeTime date={failure.timestamp} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {failure.status > 0 ? failure.status : `No response (${failure.errorKind})`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(failure.durationMs)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{failure.browser}</TableCell>
                  <TableCell className="hidden max-w-0 truncate pr-4 font-mono text-xs md:table-cell">
                    {failure.route ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
