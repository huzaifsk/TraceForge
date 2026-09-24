import { sessionListSchema } from "@traceforge/event-schema"
import { Badge } from "@traceforge/ui/components/badge"
import { Button } from "@traceforge/ui/components/button"
import { Card } from "@traceforge/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@traceforge/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@traceforge/ui/components/table"
import { UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { RelativeTime } from "@/components/data/relative-time"
import { PageHeader } from "@/components/page-header"
import { RowKeyboardNav } from "@/components/row-keyboard-nav"
import { SessionsToolbar } from "@/components/sessions/sessions-toolbar"
import { apiGet } from "@/lib/api"
import { apiQuery, parseFilters, withFilters } from "@/lib/filters"
import { formatCompact } from "@/lib/format"

export const metadata: Metadata = { title: "Sessions" }

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function SessionsPage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/sessions">) {
  const { projectId } = await params
  const query = await searchParams
  const filters = parseFilters(query)
  const offset = Math.max(0, Number(one(query.offset)) || 0)
  const q = one(query.q)
  const list = await apiGet(
    `/api/v1/projects/${projectId}/sessions?${apiQuery(filters, { q, offset: offset || undefined })}`,
    sessionListSchema
  )
  const pageHref = (nextOffset: number) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      const v = one(value)
      if (v && key !== "offset") qs.set(key, v)
    }
    if (nextOffset > 0) qs.set("offset", String(nextOffset))
    const s = qs.toString()
    return `/p/${projectId}/sessions${s ? `?${s}` : ""}`
  }

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Every browser tab that sent us something, most recent first."
      />
      <SessionsToolbar />
      <RowKeyboardNav />

      {list.sessions.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{q ? "No matching sessions" : "No sessions in this range"}</EmptyTitle>
            <EmptyDescription>
              {q
                ? "Try a different search or clear the filters."
                : "Nothing arrived from your users yet."}
            </EmptyDescription>
          </EmptyHeader>
          {q && (
            <EmptyContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={withFilters(`/p/${projectId}/sessions`, query)} />}
              >
                Clear filters
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Session</TableHead>
                <TableHead className="hidden md:table-cell">Last path</TableHead>
                <TableHead className="hidden lg:table-cell">Browser</TableHead>
                <TableHead className="w-20 text-right">Events</TableHead>
                <TableHead className="w-20 text-right">Errors</TableHead>
                <TableHead className="w-28 pr-4">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.sessions.map((session) => (
                <TableRow key={session.sessionId} className="relative">
                  <TableCell className="max-w-0 py-3 pl-4">
                    <Link
                      href={withFilters(`/p/${projectId}/sessions/${session.sessionId}`, query)}
                      data-row-link
                      className="block truncate font-mono text-xs outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {session.sessionId}
                    </Link>
                  </TableCell>
                  <TableCell className="relative z-[1] hidden truncate font-mono text-xs text-muted-foreground md:table-cell">
                    {session.lastPath}
                  </TableCell>
                  <TableCell className="relative z-[1] hidden text-muted-foreground lg:table-cell">
                    {session.browser} · {session.os}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(session.eventCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {session.errorCount > 0 ? (
                      <Badge variant="destructive">{formatCompact(session.errorCount)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="relative z-[1] pr-4 text-muted-foreground">
                    <RelativeTime date={session.lastSeen} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {(offset > 0 || list.hasMore) && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            nativeButton={false}
            render={offset === 0 ? <span /> : <Link href={pageHref(Math.max(0, offset - 50))} />}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!list.hasMore}
            nativeButton={false}
            render={list.hasMore ? <Link href={pageHref(offset + 50)} /> : <span />}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  )
}
