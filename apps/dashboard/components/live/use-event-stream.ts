"use client"

import { type LiveEvent, liveEventSchema } from "@traceforge/event-schema"
import { useEffect, useRef, useState } from "react"

export type StreamStatus = "connecting" | "open" | "reconnecting" | "paused"

/**
 * Subscribe to a project's live stream (SSE, same-origin through the dashboard
 * proxy). EventSource reconnects on its own and resumes with Last-Event-ID; the
 * connection is closed while the tab is hidden to save the user's battery.
 */
export function useEventStream(
  projectId: string,
  onEvent: (event: LiveEvent) => void
): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>("connecting")
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    let source: EventSource | null = null

    const connect = () => {
      source?.close()
      setStatus("connecting")
      source = new EventSource(`/api/v1/projects/${projectId}/stream`)
      source.onopen = () => setStatus("open")
      source.onerror = () =>
        setStatus(source?.readyState === EventSource.CLOSED ? "paused" : "reconnecting")
      source.addEventListener("pulse", (message) => {
        try {
          const parsed = liveEventSchema.safeParse(
            JSON.parse((message as MessageEvent<string>).data)
          )
          if (parsed.success) handler.current(parsed.data)
        } catch {
          // Ignore malformed frames; the stream stays open.
        }
      })
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        source?.close()
        source = null
        setStatus("paused")
      } else if (!source) {
        connect()
      }
    }

    connect()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      source?.close()
    }
  }, [projectId])

  return status
}
