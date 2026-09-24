import { releaseDetailSchema } from "@traceforge/event-schema"
import { Card, CardContent } from "@traceforge/ui/components/card"
import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { RelativeTime } from "@/components/data/relative-time"
import { DeleteReleaseButton } from "@/components/releases/delete-release-button"
import { apiGet } from "@/lib/api"
import { formatCount } from "@/lib/format"

export const metadata: Metadata = { title: "Release" }

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{children}</dd>
    </div>
  )
}

export default async function ReleasePage({
  params,
}: PageProps<"/p/[projectId]/releases/[releaseId]">) {
  const { projectId, releaseId } = await params
  const detail = await apiGet(
    `/api/v1/projects/${projectId}/releases/${releaseId}`,
    releaseDetailSchema
  )
  const { release } = detail

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href={`/p/${projectId}/releases`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Releases
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="truncate font-mono text-lg font-semibold tracking-tight">
              {release.version}
            </h1>
            {release.notes && <p className="text-sm text-muted-foreground">{release.notes}</p>}
            <p className="text-xs text-muted-foreground">
              Tagged <RelativeTime date={release.createdAt} />
            </p>
          </div>
          <DeleteReleaseButton
            projectId={projectId}
            releaseId={release.id}
            version={release.version}
          />
        </div>
      </div>

      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-3 gap-4">
            <Stat label="Events">{formatCount(detail.eventCount)}</Stat>
            <Stat label="Issues">{formatCount(detail.issueCount)}</Stat>
            <Stat label="Affected users">{formatCount(detail.affectedUsers)}</Stat>
          </dl>
        </CardContent>
      </Card>
    </>
  )
}
