import { sessionDetailSchema } from "@traceforge/event-schema"
import { Badge } from "@traceforge/ui/components/badge"
import { Card, CardContent } from "@traceforge/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@traceforge/ui/components/empty"
import { ChevronLeftIcon, RadioIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { RelativeTime } from "@/components/data/relative-time"
import { EventRow } from "@/components/timeline/event-row"
import { apiGet } from "@/lib/api"
import { apiQuery, parseFilters, withFilters } from "@/lib/filters"
import { formatCount, formatDuration } from "@/lib/format"

export const metadata: Metadata = { title: "Session" }

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{children}</dd>
    </div>
  )
}

export default async function SessionPage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/sessions/[sessionId]">) {
  const { projectId, sessionId } = await params
  const query = await searchParams
  const filters = parseFilters(query)
  const detail = await apiGet(
    `/api/v1/projects/${projectId}/sessions/${encodeURIComponent(sessionId)}?${apiQuery(filters)}`,
    sessionDetailSchema
  )
  const { session } = detail

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href={withFilters(`/p/${projectId}/sessions`, query)}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Sessions
        </Link>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {session.environment}
            </Badge>
            <Badge variant="outline">{session.browser}</Badge>
            <Badge variant="outline">{session.os}</Badge>
            <Badge variant="outline" className="capitalize">
              {session.deviceType}
            </Badge>
          </div>
          <h1 className="truncate font-mono text-lg font-semibold tracking-tight">
            {session.sessionId}
          </h1>
          {session.anonymousId && (
            <p className="truncate font-mono text-xs text-muted-foreground">
              user {session.anonymousId}
            </p>
          )}
        </div>
      </div>

      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Duration">{formatDuration(session.durationMs)}</Stat>
            <Stat label="Events">{formatCount(session.eventCount)}</Stat>
            <Stat label="Errors">{formatCount(session.errorCount)}</Stat>
            <Stat label="Last seen">
              <RelativeTime date={session.lastSeen} />
            </Stat>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Timeline</h2>
          {detail.truncated && (
            <span className="text-xs text-muted-foreground">
              Showing the most recent {detail.events.length} events
            </span>
          )}
        </div>

        {detail.events.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RadioIcon />
              </EmptyMedia>
              <EmptyTitle>No events in this range</EmptyTitle>
              <EmptyDescription>Try a wider time range.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="gap-0 py-0">
            <ol className="divide-y font-mono text-xs">
              {detail.events.map((event) => (
                <li key={event.id}>
                  <EventRow
                    event={event}
                    issueHref={
                      event.issueId ? `/p/${projectId}/issues/${event.issueId}` : undefined
                    }
                  />
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </>
  )
}
