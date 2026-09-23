import { endpointListSchema } from "@pulseed/event-schema"
import { Card } from "@pulseed/ui/components/card"
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
import { NetworkIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { MethodBadge } from "@/components/data/method-badge"
import { Sparkline } from "@/components/data/sparkline"
import { PageHeader } from "@/components/page-header"
import { RowKeyboardNav } from "@/components/row-keyboard-nav"
import { apiGet } from "@/lib/api"
import { apiQuery, parseFilters, withFilters } from "@/lib/filters"
import { formatCompact, formatDuration, formatPercent } from "@/lib/format"

export const metadata: Metadata = { title: "API performance" }

export default async function ApiPage({ params, searchParams }: PageProps<"/p/[projectId]/api">) {
  const { projectId } = await params
  const query = await searchParams
  const { endpoints } = await apiGet(
    `/api/v1/projects/${projectId}/api-endpoints?${apiQuery(parseFilters(query))}`,
    endpointListSchema
  )

  return (
    <>
      <PageHeader
        title="API performance"
        description="Every fetch your frontend made, grouped by endpoint."
      />
      <RowKeyboardNav />
      {endpoints.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NetworkIcon />
            </EmptyMedia>
            <EmptyTitle>No API requests in this range</EmptyTitle>
            <EmptyDescription>
              The SDK records every fetch() your app makes, except its own.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Endpoint</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="hidden text-right md:table-cell">Error rate</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Avg</TableHead>
                <TableHead className="text-right">P95</TableHead>
                <TableHead className="hidden w-32 pr-4 lg:table-cell">P95 trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((row) => (
                <TableRow key={`${row.method} ${row.endpoint}`} className="relative">
                  <TableCell className="max-w-0 pl-4">
                    <div className="flex items-center gap-2">
                      <MethodBadge method={row.method} />
                      <Link
                        data-row-link
                        href={withFilters(`/p/${projectId}/api/endpoint`, query, {
                          method: row.method,
                          endpoint: row.endpoint,
                        })}
                        className="truncate font-mono text-xs outline-none after:absolute after:inset-0 focus-visible:underline"
                      >
                        {row.endpoint}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(row.requests)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      row.errors > 0 && "text-status-critical-text"
                    )}
                  >
                    {formatCompact(row.errors)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {formatPercent(row.errorRate)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatDuration(row.avg)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(row.p95)}
                  </TableCell>
                  <TableCell className="hidden pr-4 lg:table-cell">
                    <Sparkline values={row.sparkline} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
