import { issueListSchema } from "@pulseed/event-schema"
import { Button } from "@pulseed/ui/components/button"
import { Card } from "@pulseed/ui/components/card"
import {
  Empty,
  EmptyContent,
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
import { CircleCheckIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { RelativeTime } from "@/components/data/relative-time"
import { Sparkline } from "@/components/data/sparkline"
import { IssueTypeIcon, issueTypeLabel } from "@/components/issues/issue-type-icon"
import { IssuesToolbar } from "@/components/issues/issues-toolbar"
import { PageHeader } from "@/components/page-header"
import { RowKeyboardNav } from "@/components/row-keyboard-nav"
import { apiGet } from "@/lib/api"
import { apiQuery, parseFilters, withFilters } from "@/lib/filters"
import { formatCompact } from "@/lib/format"

export const metadata: Metadata = { title: "Issues" }

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function IssuesPage({
  params,
  searchParams,
}: PageProps<"/p/[projectId]/issues">) {
  const { projectId } = await params
  const query = await searchParams
  const filters = parseFilters(query)
  const offset = Math.max(0, Number(one(query.offset)) || 0)
  const extra = {
    status: one(query.status),
    q: one(query.q),
    browser: one(query.browser),
    sort: one(query.sort),
    offset: offset || undefined,
  }
  const list = await apiGet(
    `/api/v1/projects/${projectId}/issues?${apiQuery(filters, extra)}`,
    issueListSchema
  )
  const filtered = !!(extra.q || extra.browser || (extra.status && extra.status !== "unresolved"))
  const pageHref = (nextOffset: number) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      const v = one(value)
      if (v && key !== "offset") qs.set(key, v)
    }
    if (nextOffset > 0) qs.set("offset", String(nextOffset))
    const s = qs.toString()
    return `/p/${projectId}/issues${s ? `?${s}` : ""}`
  }

  return (
    <>
      <PageHeader title="Issues" description="Errors grouped by what went wrong, where." />
      <IssuesToolbar browsers={list.browsers} />
      <RowKeyboardNav />

      {list.issues.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleCheckIcon />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "No matching issues" : "No issues in this range"}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try a different search or clear the filters."
                : "Nothing broke for your users. Nice."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={withFilters(`/p/${projectId}/issues`, query)} />}
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
                <TableHead className="pl-4">Issue</TableHead>
                <TableHead className="hidden w-32 lg:table-cell">Trend</TableHead>
                <TableHead className="w-20 text-right">Events</TableHead>
                <TableHead className="w-20 text-right">Users</TableHead>
                <TableHead className="hidden w-28 md:table-cell">First seen</TableHead>
                <TableHead className="w-28 pr-4">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.issues.map((issue) => (
                <TableRow key={issue.id} className="relative">
                  <TableCell className="max-w-0 py-3 pl-4">
                    <div className="flex items-start gap-2.5">
                      <IssueTypeIcon type={issue.type} className="mt-0.5" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={withFilters(`/p/${projectId}/issues/${issue.id}`, query)}
                          data-row-link
                          className="truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                        >
                          <span className="sr-only">{issueTypeLabel(issue.type)}: </span>
                          {issue.title}
                        </Link>
                        {issue.culprit && (
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {issue.culprit}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Sparkline values={issue.sparkline} variant="bars" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(issue.events)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCompact(issue.users)}
                  </TableCell>
                  <TableCell className="relative z-[1] hidden text-muted-foreground md:table-cell">
                    <RelativeTime date={issue.firstSeen} />
                  </TableCell>
                  <TableCell className="relative z-[1] pr-4 text-muted-foreground">
                    <RelativeTime date={issue.lastSeen} />
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
