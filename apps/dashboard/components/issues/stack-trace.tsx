"use client"

import type { IssueFrame } from "@pulseed/event-schema"
import { Button } from "@pulseed/ui/components/button"
import { cn } from "@pulseed/ui/lib/utils"
import { ChevronRightIcon } from "lucide-react"
import { useState } from "react"

type Group =
  | { kind: "app"; frame: IssueFrame; index: number }
  | { kind: "library"; frames: IssueFrame[]; start: number }

/** Consecutive third-party frames collapse into one expandable row. */
export function groupFrames(frames: readonly IssueFrame[]): Group[] {
  const groups: Group[] = []
  frames.forEach((frame, index) => {
    const last = groups.at(-1)
    if (frame.inApp) groups.push({ kind: "app", frame, index })
    else if (last?.kind === "library") last.frames.push(frame)
    else groups.push({ kind: "library", frames: [frame], start: index })
  })
  return groups
}

const location = (frame: IssueFrame) => {
  let file = frame.filename ?? "<unknown>"
  try {
    file = new URL(file).pathname
  } catch {
    // not a URL (e.g. webpack-internal or a bare path); show as-is
  }
  return `${file}${frame.line !== undefined ? `:${frame.line}` : ""}${frame.column !== undefined ? `:${frame.column}` : ""}`
}

function FrameRow({ frame, muted }: { frame: IssueFrame; muted?: boolean }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3",
        muted && "text-muted-foreground"
      )}
    >
      <span className="shrink-0 font-medium">{frame.function ?? "<anonymous>"}</span>
      <span className="min-w-0 break-all text-muted-foreground">{location(frame)}</span>
    </li>
  )
}

/**
 * Stack frames rendered strictly as text (they come from the browser and are
 * untrusted). In-app frames are prominent; library frames are collapsed.
 */
export function StackTrace({ frames, raw }: { frames: readonly IssueFrame[]; raw?: string }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showRaw, setShowRaw] = useState(frames.length === 0)

  if (showRaw || frames.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {raw || "No stack trace was captured for this event."}
        </pre>
        {frames.length > 0 && (
          <Button
            variant="link"
            size="sm"
            className="self-start px-0"
            onClick={() => setShowRaw(false)}
          >
            Show parsed frames
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="divide-y overflow-hidden rounded-lg border font-mono text-xs">
        {groupFrames(frames).map((group) =>
          group.kind === "app" ? (
            <FrameRow key={group.index} frame={group.frame} />
          ) : (
            <li key={`lib-${group.start}`}>
              <button
                type="button"
                aria-expanded={expanded.has(group.start)}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(group.start)) next.delete(group.start)
                    else next.add(group.start)
                    return next
                  })
                }
                className="flex w-full items-center gap-1.5 bg-muted/40 px-3 py-1.5 text-left text-muted-foreground outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <ChevronRightIcon
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform duration-150 ease-out",
                    expanded.has(group.start) && "rotate-90"
                  )}
                />
                {group.frames.length} library {group.frames.length === 1 ? "frame" : "frames"}
              </button>
              {expanded.has(group.start) && (
                <ol className="divide-y border-t">
                  {group.frames.map((frame, i) => (
                    <FrameRow key={i} frame={frame} muted />
                  ))}
                </ol>
              )}
            </li>
          )
        )}
      </ol>
      {raw && (
        <Button
          variant="link"
          size="sm"
          className="self-start px-0"
          onClick={() => setShowRaw(true)}
        >
          View raw stack trace
        </Button>
      )}
    </div>
  )
}
