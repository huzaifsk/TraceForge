import { LIMITS } from "@pulseed/event-schema/constants"
import type { EventOfType, MonitoringEvent, PageContext } from "@pulseed/event-schema/types"

import { truncate } from "./util"

type EventType = MonitoringEvent["type"]

/** What an integration hands to the client; context is filled in centrally. */
export type EventDraft = {
  [K in EventType]: {
    type: K
    payload: EventOfType<K>["payload"]
    timestamp?: number
    tags?: Readonly<Record<string, string>>
    /** Page the event belongs to, when it differs from the current page (Web Vitals). */
    page?: PageContext
  }
}[EventType]

const SECRET_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bBearer\s+[\w\-.~+/]+=*/gi, "Bearer [redacted]"],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted-jwt]"],
]

/** Strip bearer tokens and JWTs that apps sometimes interpolate into error messages. */
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text
  )
}

/** Enforce the per-tag limits from the wire contract. */
export function limitTags(tags: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {}
  let count = 0
  for (const [key, value] of Object.entries(tags)) {
    if (count++ >= LIMITS.maxTagCount) break
    if (typeof value !== "string") continue
    out[truncate(key, LIMITS.maxTagKeyLength)] = truncate(value, LIMITS.maxTagValueLength)
  }
  return out
}

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length

/**
 * Apply field limits and redaction, then make sure the serialized event fits
 * in 64 KB — dropping the stack, then the component stack, before giving up.
 */
export function prepareEvent(event: MonitoringEvent): MonitoringEvent | null {
  let prepared = event
  if (prepared.type === "error" || prepared.type === "unhandled_rejection") {
    const p = prepared.payload
    prepared = {
      ...prepared,
      payload: {
        ...p,
        name: truncate(p.name, 128),
        message: truncate(redactSecrets(p.message), LIMITS.maxMessageLength),
        ...(p.stack && { stack: truncate(redactSecrets(p.stack), LIMITS.maxStackLength) }),
        ...(p.frames && { frames: p.frames.slice(0, LIMITS.maxStackFrames) }),
        ...(p.componentStack && {
          componentStack: truncate(p.componentStack, LIMITS.maxComponentStackLength),
        }),
      },
    }
  }

  if (byteLength(prepared) <= LIMITS.maxEventBytes) return prepared
  if (prepared.type !== "error" && prepared.type !== "unhandled_rejection") return null

  const { stack: _stack, frames: _frames, ...withoutStack } = prepared.payload
  prepared = { ...prepared, payload: withoutStack }
  if (byteLength(prepared) <= LIMITS.maxEventBytes) return prepared

  const { componentStack: _componentStack, ...bare } = prepared.payload
  prepared = { ...prepared, payload: bare }
  return byteLength(prepared) <= LIMITS.maxEventBytes ? prepared : null
}

/**
 * Collapses error loops: the same error more than `limit` times per minute is
 * dropped so a render loop cannot flood the queue or the user's network.
 */
export class Deduper {
  private readonly seen = new Map<string, number[]>()

  constructor(
    private readonly limit = 10,
    private readonly windowMs = 60_000
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const recent = (this.seen.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (recent.length >= this.limit) {
      this.seen.set(key, recent)
      return false
    }
    recent.push(now)
    this.seen.set(key, recent)
    if (this.seen.size > 500) this.seen.delete(this.seen.keys().next().value!)
    return true
  }
}

/** Grouping key for de-duplication; the server computes the real fingerprint. */
export function dedupeKey(event: MonitoringEvent): string | null {
  switch (event.type) {
    case "error":
    case "unhandled_rejection":
      return `${event.type}:${event.payload.name}:${event.payload.message}`
    case "api_error":
      return `api:${event.payload.method}:${event.payload.endpoint}:${event.payload.status}`
    default:
      return null
  }
}
