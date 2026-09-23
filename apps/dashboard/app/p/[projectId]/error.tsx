"use client"

import { Button } from "@traceforge/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@traceforge/ui/components/empty"
import { TriangleAlertIcon } from "lucide-react"

/** Route-level fallback. Never shows raw server error messages. */
export default function ProjectError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>This page couldn&apos;t load</EmptyTitle>
        <EmptyDescription>
          The TraceForge API may be unavailable. Your data is safe.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>Try again</Button>
      </EmptyContent>
    </Empty>
  )
}
