import type { LiveEvent } from "@pulseed/event-schema"
import type { MonitoringEvent } from "@pulseed/event-schema/types"

import type { EnrichedEvent } from "./ingest"

const MAX_SUMMARY = 160

const clip = (text: string) =>
  text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 1)}…` : text

const formatMs = (ms: number) =>
  ms >= 1_000 ? `${(ms / 1_000).toFixed(2)} s` : `${Math.round(ms)} ms`

/** One human-readable line per event for the live stream. Never includes stacks. */
export function summarize(event: MonitoringEvent): string {
  switch (event.type) {
    case "error":
    case "unhandled_rejection":
      return clip(`${event.payload.name}: ${event.payload.message}`)
    case "api_error": {
      const { method, endpoint, status, errorKind } = event.payload
      return clip(`${method} ${endpoint} → ${status > 0 ? status : `${errorKind} error`}`)
    }
    case "api_request": {
      const { method, endpoint, status, durationMs } = event.payload
      return clip(`${method} ${endpoint} ${status} · ${formatMs(durationMs)}`)
    }
    case "web_vital": {
      const { name, value, rating } = event.payload
      const shown = name === "CLS" ? value.toFixed(3) : formatMs(value)
      return `${name} ${shown} · ${rating.replace("-", " ")}`
    }
    case "navigation":
      return clip(
        event.payload.from ? `${event.payload.from} → ${event.payload.to}` : event.payload.to
      )
    case "performance":
      return event.payload.loadMs !== undefined
        ? `Page load ${formatMs(event.payload.loadMs)}`
        : "Page load"
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
