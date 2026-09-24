import { releaseListSchema } from "@traceforge/event-schema"
import { Card } from "@traceforge/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@traceforge/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@traceforge/ui/components/table"
import { TagIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { RelativeTime } from "@/components/data/relative-time"
import { PageHeader } from "@/components/page-header"
import { NewReleaseDialog } from "@/components/releases/new-release-dialog"
import { apiGet } from "@/lib/api"

export const metadata: Metadata = { title: "Releases" }

export default async function ReleasesPage({ params }: PageProps<"/p/[projectId]/releases">) {
  const { projectId } = await params
  const { releases } = await apiGet(`/api/v1/projects/${projectId}/releases`, releaseListSchema)

  return (
    <>
      <PageHeader
        title="Releases"
        description="Version markers tagged for this project, most recent first."
        actions={<NewReleaseDialog projectId={projectId} />}
      />

      {releases.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon />
            </EmptyMedia>
            <EmptyTitle>No releases yet</EmptyTitle>
            <EmptyDescription>
              Tag a release to see which issues and events showed up in it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Version</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead className="w-28 pr-4">Tagged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.map((release) => (
                <TableRow key={release.id} className="relative">
                  <TableCell className="max-w-0 py-3 pl-4">
                    <Link
                      href={`/p/${projectId}/releases/${release.id}`}
                      data-row-link
                      className="block truncate font-mono text-xs outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {release.version}
                    </Link>
                  </TableCell>
                  <TableCell className="relative z-[1] hidden truncate text-muted-foreground md:table-cell">
                    {release.notes ?? "—"}
                  </TableCell>
                  <TableCell className="relative z-[1] pr-4 text-muted-foreground">
                    <RelativeTime date={release.createdAt} />
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
