import { Badge } from "@traceforge/ui/components/badge"
import { cn } from "@traceforge/ui/lib/utils"
import Link from "next/link"

import { formatClock } from "@/lib/format"

export const TYPE_LABELS: Record<string, string> = {
  error: "Error",
  unhandled_rejection: "Rejection",
  api_error: "API error",
  api_request: "API",
  web_vital: "Web vital",
  navigation: "Navigation",
  performance: "Page load",
}

export const ISSUE_TYPES = new Set(["error", "unhandled_rejection", "api_error"])

export interface TimelineEvent {
  id: string
  type: string
  timestamp: string | number
  path: string
  summary: string
  issueId?: string | null
}

/** One row of a chronological event list: time, type badge, path, summary. Used by
 * the live stream and the session timeline, so both read identically. */
export function EventRow({ event, issueHref }: { event: TimelineEvent; issueHref?: string }) {
  const content = (
    <>
      <time
        dateTime={new Date(event.timestamp).toISOString()}
        className="w-16 shrink-0 text-muted-foreground tabular-nums"
      >
        {formatClock(event.timestamp)}
      </time>
      <Badge
        variant={ISSUE_TYPES.has(event.type) ? "destructive" : "outline"}
        className="w-24 shrink-0 justify-center font-sans"
      >
        {TYPE_LABELS[event.type] ?? event.type}
      </Badge>
      <span className="hidden w-40 shrink-0 truncate text-muted-foreground sm:block">
        {event.path}
      </span>
      <span className="min-w-0 flex-1 truncate font-sans text-sm">{event.summary}</span>
    </>
  )
  const className =
    "flex items-center gap-3 px-4 py-2 [content-visibility:auto] [contain-intrinsic-size:auto_40px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"

  return issueHref ? (
    <Link
      href={issueHref}
      className={cn(className, "outline-none hover:bg-muted/50 focus-visible:bg-muted/50")}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}
