import type { Metadata } from "next"

import { LiveStream } from "@/components/live/live-stream"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = { title: "Live events" }

export default async function LivePage({ params }: PageProps<"/p/[projectId]/live">) {
  const { projectId } = await params
  return (
    <>
      <PageHeader
        title="Live events"
        description="Everything your users' browsers send, as it arrives."
      />
      <LiveStream projectId={projectId} />
    </>
  )
}
