import { describe, expect, it } from "vitest"

import { LIMITS, SCHEMA_VERSION } from "./constants"
import { ingestBatchSchema, monitoringEventSchema } from "./schema"

const baseEvent = {
  id: "0b5a4f8e-6f0e-4c1a-9a57-2d7f0b1c3e4d",
  timestamp: 1_758_620_000_000,
  environment: "production",
  sessionId: "s_8f2k1",
  page: { url: "https://shop.example.com/orders", path: "/orders" },
  device: { browser: "Chrome", os: "macOS", deviceType: "desktop" },
} as const

describe("monitoringEventSchema", () => {
  it("accepts a well-formed error event", () => {
    const result = monitoringEventSchema.safeParse({
      ...baseEvent,
      type: "error",
      payload: {
        name: "TypeError",
        message: "Cannot read properties of undefined (reading 'id')",
        mechanism: "onerror",
        handled: false,
      },
    })

    expect(result.success).toBe(true)
  })

  it("accepts an api_error event with a network failure status of 0", () => {
    const result = monitoringEventSchema.safeParse({
      ...baseEvent,
      type: "api_error",
      payload: {
        method: "GET",
        url: "https://shop.example.com/api/orders",
        endpoint: "/api/orders",
        status: 0,
        durationMs: 1_800,
        transport: "fetch",
        errorKind: "network",
      },
    })

    expect(result.success).toBe(true)
  })

  it("rejects a payload that does not match its discriminator", () => {
    const result = monitoringEventSchema.safeParse({
      ...baseEvent,
      type: "web_vital",
      payload: { name: "TypeError", message: "boom", mechanism: "onerror", handled: false },
    })

    expect(result.success).toBe(false)
  })

  it("rejects an unknown web vital", () => {
    const result = monitoringEventSchema.safeParse({
      ...baseEvent,
      type: "web_vital",
      payload: { name: "FID", value: 12, rating: "good", delta: 12 },
    })

    expect(result.success).toBe(false)
  })

  it("rejects messages longer than the limit", () => {
    const result = monitoringEventSchema.safeParse({
      ...baseEvent,
      type: "error",
      payload: {
        name: "Error",
        message: "x".repeat(LIMITS.maxMessageLength + 1),
        mechanism: "manual",
        handled: true,
      },
    })

    expect(result.success).toBe(false)
  })
})

describe("ingestBatchSchema", () => {
  const batch = {
    schemaVersion: SCHEMA_VERSION,
    projectId: "pw_12345abc",
    sdk: { name: "@pulseed/sdk", version: "0.1.0" },
    sentAt: 1_758_620_000_500,
    events: [{}],
  }

  it("accepts a valid envelope", () => {
    expect(ingestBatchSchema.safeParse(batch).success).toBe(true)
  })

  it("rejects an empty batch", () => {
    expect(ingestBatchSchema.safeParse({ ...batch, events: [] }).success).toBe(false)
  })

  it("rejects batches over the event limit", () => {
    const events = Array.from({ length: LIMITS.maxEventsPerBatch + 1 }, () => ({}))
    expect(ingestBatchSchema.safeParse({ ...batch, events }).success).toBe(false)
  })

  it("rejects malformed project ids", () => {
    expect(ingestBatchSchema.safeParse({ ...batch, projectId: "12345" }).success).toBe(false)
  })
})
