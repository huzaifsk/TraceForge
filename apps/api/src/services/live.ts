import type { LiveEvent } from "@traceforge/event-schema"
import type { EventType } from "@traceforge/event-schema/constants"

import type { EnrichedEvent } from "./ingest"

const MAX_SUMMARY = 160

const clip = (text: string) =>
  text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 1)}…` : text

const formatMs = (ms: number) =>
  ms >= 1_000 ? `${(ms / 1_000).toFixed(2)} s` : `${Math.round(ms)} ms`

/**
 * Loosened event shape `summarize` needs: a typed `MonitoringEvent` satisfies it for
 * free, and so does a raw `{ type, payload }` row read back from storage (used by the
 * session timeline), where `payload` is trusted jsonb rather than a freshly-validated union.
 */
interface SummarizableEvent {
  type: EventType
  payload: unknown
}

/** One human-readable line per event, for the live stream and session timelines. Never includes stacks. */
export function summarize(event: SummarizableEvent): string {
  switch (event.type) {
    case "error":
    case "unhandled_rejection": {
      const { name, message } = event.payload as { name: string; message: string }
      return clip(`${name}: ${message}`)
    }
    case "api_error": {
      const { method, endpoint, status, errorKind } = event.payload as {
        method: string
        endpoint: string
        status: number
        errorKind: string
      }
      return clip(`${method} ${endpoint} → ${status > 0 ? status : `${errorKind} error`}`)
    }
    case "api_request": {
      const { method, endpoint, status, durationMs } = event.payload as {
        method: string
        endpoint: string
        status: number
        durationMs: number
      }
      return clip(`${method} ${endpoint} ${status} · ${formatMs(durationMs)}`)
    }
    case "web_vital": {
      const { name, value, rating } = event.payload as {
        name: string
        value: number
        rating: string
      }
      const shown = name === "CLS" ? value.toFixed(3) : formatMs(value)
      return `${name} ${shown} · ${rating.replace("-", " ")}`
    }
    case "navigation": {
      const { from, to } = event.payload as { from?: string; to: string }
      return clip(from ? `${from} → ${to}` : to)
    }
    case "performance": {
      const { loadMs } = event.payload as { loadMs?: number }
      return loadMs !== undefined ? `Page load ${formatMs(loadMs)}` : "Page load"
    }
  }
}

export function toLiveEvents(
  inserted: readonly EnrichedEvent[],
  issueIds: ReadonlyMap<string, string>
): LiveEvent[] {
  return inserted.map(({ event, timestamp, fingerprint }) => ({
    id: event.id,
    type: event.type,
    timestamp: timestamp.getTime(),
    path: event.page.path,
    environment: event.environment,
    summary: summarize(event),
    issueId: fingerprint ? (issueIds.get(fingerprint) ?? null) : null,
  }))
}
