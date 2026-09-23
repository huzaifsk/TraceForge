"use client"

import type { LiveEvent } from "@traceforge/event-schema"
import { Badge } from "@traceforge/ui/components/badge"
import { Button } from "@traceforge/ui/components/button"
import { Card } from "@traceforge/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@traceforge/ui/components/empty"
import { cn } from "@traceforge/ui/lib/utils"
import { PauseIcon, PlayIcon, RadioIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { formatClock } from "@/lib/format"

import { type StreamStatus, useEventStream } from "./use-event-stream"

const MAX_ROWS = 500

const TYPE_LABELS: Record<string, string> = {
  error: "Error",
  unhandled_rejection: "Rejection",
  api_error: "API error",
  api_request: "API",
  web_vital: "Web vital",
  navigation: "Navigation",
  performance: "Page load",
}

const ISSUE_TYPES = new Set(["error", "unhandled_rejection", "api_error"])

const STATUS: Record<StreamStatus, { label: string; tone: string }> = {
  open: { label: "Live", tone: "bg-status-good" },
  connecting: { label: "Connecting", tone: "bg-muted-foreground" },
  reconnecting: { label: "Reconnecting", tone: "bg-status-warning" },
  paused: { label: "Paused while hidden", tone: "bg-muted-foreground" },
}

export function LiveStream({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<LiveEvent[]>([])
  const [held, setHeld] = useState<LiveEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (paused) setHeld((current) => [event, ...current].slice(0, MAX_ROWS))
      else setRows((current) => [event, ...current].slice(0, MAX_ROWS))
    },
    [paused]
  )
  const status = useEventStream(projectId, onEvent)

  // Announce arrivals politely and in batches, never once per row.
  useEffect(() => {
    if (rows.length === 0) return
    const timer = setTimeout(() => setAnnouncement(`${rows.length} events received`), 2_000)
    return () => clearTimeout(timer)
  }, [rows.length])

  const resume = () => {
    setRows((current) => [...held, ...current].slice(0, MAX_ROWS))
    setHeld([])
    setPaused(false)
  }

  const indicator = STATUS[status]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm">
          <span className="relative flex size-2">
            {status === "open" && !paused && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-good opacity-60 motion-reduce:hidden" />
            )}
            <span className={cn("relative inline-flex size-2 rounded-full", indicator.tone)} />
          </span>
          {paused ? "Paused" : indicator.label}
        </span>
        <div className="flex items-center gap-2">
          {paused && held.length > 0 && (
            <Button size="sm" variant="secondary" onClick={resume}>
              {held.length} new {held.length === 1 ? "event" : "events"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => (paused ? resume() : setPaused(true))}>
            {paused ? (
              <PlayIcon data-icon="inline-start" />
            ) : (
              <PauseIcon data-icon="inline-start" />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RadioIcon />
            </EmptyMedia>
            <EmptyTitle>Listening for events</EmptyTitle>
            <EmptyDescription>
              New errors, API calls and vitals appear here the moment they are ingested.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <ol className="divide-y font-mono text-xs">
            {rows.map((event) => {
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
              return (
                <li key={event.id}>
                  {event.issueId ? (
                    <Link
                      href={`/p/${projectId}/issues/${event.issueId}`}
                      className={cn(
                        className,
                        "outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                      )}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={className}>{content}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      )}
    </div>
  )
}
