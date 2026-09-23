import { issueDetailSchema } from "@traceforge/event-schema"
import { Badge } from "@traceforge/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@traceforge/ui/components/tabs"
import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Breakdown } from "@/components/data/breakdown"
import { MethodBadge } from "@/components/data/method-badge"
import { RelativeTime } from "@/components/data/relative-time"
import { IssueActions } from "@/components/issues/issue-actions"
import { IssueTypeIcon, issueTypeLabel } from "@/components/issues/issue-type-icon"
import { OccurrencesChart } from "@/components/issues/occurrences-chart"
import { StackTrace } from "@/components/issues/stack-trace"
import { apiGet } from "@/lib/api"
import { apiQuery, parseFilters, withFilters } from "@/lib/filters"
import { formatCount, formatDateTime, formatDuration } from "@/lib/format"

export const metadata: Metadata = { title: "Issue" }

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{children}</dd>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

export default async function IssuePage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/issues/[issueId]">) {
  const { projectId, issueId } = await params
  const query = await searchParams
  const filters = parseFilters(query)
  const detail = await apiGet(
    `/api/v1/projects/${projectId}/issues/${encodeURIComponent(issueId)}?${apiQuery(filters)}`,
    issueDetailSchema
  )
  const { issue, latestEvent: event } = detail
  const device = event?.device

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href={withFilters(`/p/${projectId}/issues`, query)}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Issues
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <IssueTypeIcon type={issue.type} className="size-3" />
                {issueTypeLabel(issue.type)}
              </Badge>
              {issue.status !== "unresolved" && (
                <Badge variant="secondary" className="capitalize">
                  {issue.status}
                </Badge>
              )}
              {issue.firstRelease && (
                <Badge variant="outline" className="font-mono">
                  first in {issue.firstRelease}
                </Badge>
              )}
            </div>
            <h1 className="line-clamp-3 text-xl font-semibold tracking-tight break-words">
              {issue.title}
            </h1>
            {issue.culprit && (
              <p className="truncate font-mono text-xs text-muted-foreground">{issue.culprit}</p>
            )}
          </div>
          <IssueActions projectId={projectId} issueId={issue.id} status={issue.status} />
        </div>
      </div>

      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Events in range">{formatCount(detail.events)}</Stat>
            <Stat label="Users in range">{formatCount(detail.users)}</Stat>
            <Stat label="First seen">
              <RelativeTime date={issue.firstSeen} />
            </Stat>
            <Stat label="Last seen">
              <RelativeTime date={issue.lastSeen} />
            </Stat>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Occurrences</CardTitle>
          <CardDescription>
            {formatCount(issue.totalEvents)} events and {formatCount(issue.totalUsers)} users all
            time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OccurrencesChart detail={detail} />
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{event?.request ? "Request" : "Stack trace"}</CardTitle>
            <CardDescription>
              {event ? (
                <>Latest event, {formatDateTime(event.timestamp)}</>
              ) : (
                "No events in this range"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {event?.request ? (
              <dl className="divide-y">
                <Detail label="Request">
                  <span className="flex items-center gap-2">
                    <MethodBadge method={event.request.method} />
                    <span className="font-mono text-xs break-all">{event.request.url}</span>
                  </span>
                </Detail>
                <Detail label="Status">
                  {event.request.status > 0
                    ? event.request.status
                    : `No response (${event.request.errorKind})`}
                </Detail>
                <Detail label="Duration">{formatDuration(event.request.durationMs)}</Detail>
              </dl>
            ) : event?.componentStack ? (
              <Tabs defaultValue="stack">
                <TabsList>
                  <TabsTrigger value="stack">Stack trace</TabsTrigger>
                  <TabsTrigger value="components">Component stack</TabsTrigger>
                </TabsList>
                <TabsContent value="stack">
                  <StackTrace frames={event.frames} raw={event.stack} />
                </TabsContent>
                <TabsContent value="components">
                  <pre className="overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
                    {event.componentStack}
                  </pre>
                </TabsContent>
              </Tabs>
            ) : (
              <StackTrace frames={event?.frames ?? []} raw={event?.stack} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest event</CardTitle>
          </CardHeader>
          <CardContent>
            {event && device ? (
              <dl className="divide-y">
                <Detail label="Page">
                  <span className="font-mono text-xs break-all">{event.url}</span>
                </Detail>
                <Detail label="Environment">
                  <span className="capitalize">{event.environment}</span>
                </Detail>
                {event.release && (
                  <Detail label="Release">
                    <span className="font-mono text-xs">{event.release}</span>
                  </Detail>
                )}
                <Detail label="Browser">
                  {device.browser}
                  {device.browserVersion && ` ${device.browserVersion}`}
                </Detail>
                <Detail label="OS">
                  {device.os}
                  {device.osVersion && ` ${device.osVersion}`}
                </Detail>
                <Detail label="Device">
                  <span className="capitalize">{device.deviceType}</span>
                </Detail>
                {device.viewport && (
                  <Detail label="Viewport">
                    <span className="tabular-nums">
                      {device.viewport.width} × {device.viewport.height}
                    </span>
                  </Detail>
                )}
                {device.language && <Detail label="Language">{device.language}</Detail>}
                {device.connection && (
                  <Detail label="Connection">{device.connection.toUpperCase()}</Detail>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No events in this range.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-label="Breakdowns" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Breakdown title="Browser" rows={detail.breakdowns.browser} />
        <Breakdown title="Operating system" rows={detail.breakdowns.os} />
        <Breakdown
          title="Device"
          rows={detail.breakdowns.deviceType.map((r) => ({
            ...r,
            value: r.value[0]!.toUpperCase() + r.value.slice(1),
          }))}
        />
        <Breakdown title="Page" rows={detail.breakdowns.path} mono />
      </section>
    </>
  )
}
