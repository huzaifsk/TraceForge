import { INGEST_KEY_QUERY, SCHEMA_VERSION } from "@traceforge/event-schema/constants"
import type { IngestBatch, MonitoringEvent } from "@traceforge/event-schema/types"

import type { ParsedDsn } from "./dsn"

/** `keepalive` requests and beacons share a 64 KB in-flight budget; stay under it. */
const KEEPALIVE_MAX_BYTES = 60_000
const GZIP_MIN_BYTES = 1_024

export type SendResult =
  { status: "ok" } | { status: "retry"; retryAfterMs?: number } | { status: "drop"; reason: string }

export interface Transport {
  send(events: readonly MonitoringEvent[], options?: { unload?: boolean }): Promise<SendResult>
  /** True for the SDK's own requests, so fetch instrumentation can skip them. */
  isOwnRequest(url: string): boolean
}

const encoder = new TextEncoder()

async function gzip(body: string): Promise<ArrayBuffer | null> {
  if (typeof CompressionStream === "undefined") return null
  try {
    const stream = new Blob([body]).stream().pipeThrough(new CompressionStream("gzip"))
    return await new Response(stream).arrayBuffer()
  } catch {
    return null
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined
}

/** Split events into batches whose serialized size fits `maxBytes`. */
function chunkBySize(events: readonly MonitoringEvent[], maxBytes: number): MonitoringEvent[][] {
  const chunks: MonitoringEvent[][] = []
  let current: MonitoringEvent[] = []
  let size = 200 // envelope overhead
  for (const event of events) {
    const eventSize = encoder.encode(JSON.stringify(event)).length + 1
    if (current.length > 0 && size + eventSize > maxBytes) {
      chunks.push(current)
      current = []
      size = 200
    }
    current.push(event)
    size += eventSize
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

/**
 * Delivers batches to the ingestion API as CORS "simple" requests (text/plain,
 * key in the query string — ADR 12), so no preflight is needed and page-unload
 * delivery via `sendBeacon` works.
 */
export function createTransport(
  dsn: ParsedDsn,
  sdk: { name: string; version: string },
  nativeFetch: typeof fetch | undefined
): Transport {
  const baseUrl = `${dsn.ingestUrl}?${INGEST_KEY_QUERY}=${encodeURIComponent(dsn.publicKey)}`

  const envelope = (events: readonly MonitoringEvent[]): IngestBatch => ({
    schemaVersion: SCHEMA_VERSION,
    projectId: dsn.projectId,
    sdk,
    sentAt: Date.now(),
    events: [...events],
  })

  async function post(body: BodyInit, url: string, keepalive: boolean): Promise<SendResult> {
    if (!nativeFetch) return { status: "drop", reason: "fetch unavailable" }
    let response: Response
    try {
      response = await nativeFetch(url, {
        method: "POST",
        body,
        keepalive,
        credentials: "omit",
        headers: { "content-type": "text/plain;charset=UTF-8" },
      })
    } catch {
      return { status: "retry" }
    }
    if (response.ok) return { status: "ok" }
    if (response.status === 429 || response.status >= 500) {
      return { status: "retry", retryAfterMs: parseRetryAfter(response.headers.get("retry-after")) }
    }
    return { status: "drop", reason: `HTTP ${response.status}` }
  }

  return {
    isOwnRequest: (url) => url.startsWith(dsn.ingestUrl),

    async send(events, { unload = false } = {}) {
      if (events.length === 0) return { status: "ok" }

      if (unload) {
        // The page is going away: beacons are the only delivery that reliably survives.
        let result: SendResult = { status: "ok" }
        for (const chunk of chunkBySize(events, KEEPALIVE_MAX_BYTES)) {
          const body = JSON.stringify(envelope(chunk))
          const queued =
            typeof navigator.sendBeacon === "function" &&
            navigator.sendBeacon(baseUrl, new Blob([body], { type: "text/plain;charset=UTF-8" }))
          if (!queued) result = await post(body, baseUrl, true)
        }
        return result
      }

      const body = JSON.stringify(envelope(events))
      const size = encoder.encode(body).length
      if (size >= GZIP_MIN_BYTES) {
        const compressed = await gzip(body)
        if (compressed) {
          return post(
            compressed,
            `${baseUrl}&enc=gzip`,
            compressed.byteLength < KEEPALIVE_MAX_BYTES
          )
        }
      }
      return post(body, baseUrl, size < KEEPALIVE_MAX_BYTES)
    },
  }
}
