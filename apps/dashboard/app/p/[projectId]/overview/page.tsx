import { overviewSchema } from "@traceforge/event-schema"
import { Button } from "@traceforge/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@traceforge/ui/components/empty"
import { BugIcon, NetworkIcon, TriangleAlertIcon, UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { MethodBadge } from "@/components/data/method-badge"
import { Sparkline } from "@/components/data/sparkline"
import { StatTile } from "@/components/data/stat-tile"
import { VitalCard } from "@/components/data/vital-card"
import { ErrorTrend } from "@/components/overview/error-trend"
import { Onboarding } from "@/components/overview/onboarding"
import { PageHeader } from "@/components/page-header"
import { apiGet } from "@/lib/api"
import { getProject } from "@/lib/data"
import { apiQuery, parseFilters, withFilters } from "@/lib/filters"
import { formatCompact, formatCount, formatDuration, formatPercent } from "@/lib/format"

export const metadata: Metadata = { title: "Overview" }

const RANGE_TEXT = {
  "1h": "the last hour",
  "24h": "the last 24 hours",
  "7d": "the last 7 days",
  "30d": "the last 30 days",
}

function ListEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border-0 p-6">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription className="text-xs">{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default async function OverviewPage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/overview">) {
  const { projectId } = await params
  const query = await searchParams
  const project = await getProject(projectId)
  if (!project.lastEventAt) return <Onboarding project={project} />

  const filters = parseFilters(query)
  const overview = await apiGet(
    `/api/v1/projects/${projectId}/overview?${apiQuery(filters)}`,
    overviewSchema
  )
  const { kpis, trend } = overview
  const base = `/p/${projectId}`

  return (
    <>
      <PageHeader
        title="Overview"
        description={`What your users experienced in ${RANGE_TEXT[filters.range]}.`}
      />

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Errors"
          icon={BugIcon}
          value={formatCompact(kpis.errors.value)}
          current={kpis.errors.value}
          previous={kpis.errors.previous}
          polarity="up-is-bad"
          trend={trend.map((p) => p.errors + p.rejections)}
        />
        <StatTile
          label="API failures"
          icon={NetworkIcon}
          value={formatCompact(kpis.apiFailures.value)}
          current={kpis.apiFailures.value}
          previous={kpis.apiFailures.previous}
          polarity="up-is-bad"
          trend={trend.map((p) => p.apiFailures)}
        />
        <StatTile
          label="Users"
          icon={UsersIcon}
          value={formatCompact(kpis.users.value)}
          current={kpis.users.value}
          previous={kpis.users.previous}
          polarity="up-is-good"
          trend={trend.map((p) => p.users)}
        />
        <StatTile
          label="Sessions with errors"
          icon={TriangleAlertIcon}
          value={formatPercent(kpis.errorRate.value)}
          current={kpis.errorRate.value}
          previous={kpis.errorRate.previous}
          polarity="up-is-bad"
        />
      </section>

      <section aria-label="Core Web Vitals" className="grid gap-4 md:grid-cols-3">
        {overview.vitals.map((vital) => (
          <VitalCard key={vital.name} vital={vital} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Error trend</CardTitle>
            <CardDescription>Uncaught errors and unhandled promise rejections</CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorTrend overview={overview} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top issues</CardTitle>
            <CardDescription>Unresolved, by events in range</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={withFilters(`${base}/issues`, query)} />}
              >
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {overview.topIssues.length === 0 ? (
              <ListEmpty
                title="No open issues"
                description="Nothing unresolved happened in this range."
              />
            ) : (
              <ul className="flex flex-col">
                {overview.topIssues.map((issue) => (
                  <li key={issue.id}>
                    <Link
                      href={withFilters(`${base}/issues/${issue.id}`, query)}
                      className="flex items-center gap-3 px-(--card-spacing) py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{issue.title}</span>
                      <Sparkline
                        values={issue.sparkline}
                        variant="bars"
                        className="w-16 shrink-0"
                      />
                      <span className="w-12 shrink-0 text-right text-sm tabular-nums">
                        {formatCompact(issue.events)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EndpointCard
          title="Slowest endpoints"
          description="By p95 latency"
          empty="No API requests in this range."
          href={withFilters(`${base}/api`, query)}
          rows={overview.slowestEndpoints.map((row) => ({
            ...row,
            href: withFilters(`${base}/api/endpoint`, query, {
              method: row.method,
              endpoint: row.endpoint,
            }),
            value: formatDuration(row.p95),
          }))}
        />
        <EndpointCard
          title="Failing endpoints"
          description="By failed requests"
          empty="No failed API requests in this range."
          href={withFilters(`${base}/api`, query)}
          rows={overview.failingEndpoints.map((row) => ({
            ...row,
            href: withFilters(`${base}/api/endpoint`, query, {
              method: row.method,
              endpoint: row.endpoint,
            }),
            value: `${formatCount(row.errors)} of ${formatCount(row.requests)}`,
          }))}
        />
      </section>
    </>
  )
}

function EndpointCard({
  title,
  description,
  empty,
  href,
  rows,
}: {
  title: string
  description: string
  empty: string
  href: string
  rows: { method: string; endpoint: string; value: string; href: string }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={href} />}>
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <ListEmpty title="Nothing to show" description={empty} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li key={`${row.method} ${row.endpoint}`}>
                <Link
                  href={row.href}
                  className="flex items-center gap-3 px-(--card-spacing) py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                >
                  <MethodBadge method={row.method} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{row.endpoint}</span>
                  <span className="shrink-0 text-sm tabular-nums">{row.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
