import { LIMITS } from "@pulseed/event-schema/constants"
import type { MonitoringEvent } from "@pulseed/event-schema/types"
import { describe, expect, it } from "vitest"

import { Deduper, limitTags, prepareEvent, redactSecrets } from "./pipeline"

const base = {
  id: "0b5a4f8e-6f0e-4c1a-9a57-2d7f0b1c3e4d",
  timestamp: 1,
  environment: "production",
  sessionId: "s",
  page: { url: "https://x.test/", path: "/" },
  device: { browser: "Chrome", os: "macOS", deviceType: "desktop" },
} as const

const error = (payload: Partial<Extract<MonitoringEvent, { type: "error" }>["payload"]> = {}) =>
  ({
    ...base,
    type: "error",
    payload: { name: "Error", message: "boom", mechanism: "manual", handled: true, ...payload },
  }) as MonitoringEvent

const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length

describe("redactSecrets", () => {
  it("removes bearer tokens and JWTs", () => {
    expect(redactSecrets("401 for Bearer abc.def-123")).toBe("401 for Bearer [redacted]")
    expect(redactSecrets("bad token eyJhbGciOi.eyJzdWIiOjF9.c2lnbmF0dXJl")).toBe(
      "bad token [redacted-jwt]"
    )
  })
})

describe("prepareEvent", () => {
  it("truncates long messages and redacts secrets in them", () => {
    const prepared = prepareEvent(error({ message: `Bearer secret ${"x".repeat(5_000)}` }))
    if (prepared?.type !== "error") throw new Error("expected an error event")
    expect(prepared.payload.message.length).toBe(LIMITS.maxMessageLength)
    expect(prepared.payload.message).not.toContain("secret")
  })

  it("keeps every prepared event within 64 KB, dropping the stack first", () => {
    const prepared = prepareEvent(
      error({ stack: "s".repeat(15_000), componentStack: "c".repeat(8_000) })
    )
    expect(prepared).not.toBeNull()
    expect(size(prepared)).toBeLessThanOrEqual(LIMITS.maxEventBytes)
  })

  it("drops non-error events that cannot fit", () => {
    const vital = {
      ...base,
      tags: { a: "x".repeat(70_000) },
      type: "web_vital",
      payload: { name: "LCP", value: 1, rating: "good", delta: 1 },
    } as MonitoringEvent
    expect(prepareEvent(vital)).toBeNull()
  })
})

describe("limitTags", () => {
  it("caps the count and lengths", () => {
    const tags = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`k${i}`, "v".repeat(300)])
    )
    const limited = limitTags(tags)
    expect(Object.keys(limited)).toHaveLength(LIMITS.maxTagCount)
    expect(limited.k0?.length).toBe(LIMITS.maxTagValueLength)
  })
})

describe("Deduper", () => {
  it("allows ten per minute per key, then recovers", () => {
    const deduper = new Deduper(10, 60_000)
    const allowed = Array.from({ length: 12 }, () => deduper.allow("a", 1_000))
    expect(allowed.filter(Boolean)).toHaveLength(10)
    expect(deduper.allow("b", 1_000)).toBe(true)
    expect(deduper.allow("a", 62_000)).toBe(true)
  })
})
