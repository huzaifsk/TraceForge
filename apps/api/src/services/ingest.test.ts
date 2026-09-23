import { LIMITS } from "@pulseed/event-schema/constants"
import { describe, expect, it } from "vitest"

import { apiErrorEvent, errorEvent } from "../test/helpers"
import {
  correctTimestamp,
  describeIssue,
  enrichEvents,
  sanitizeStack,
  validateEvents,
} from "./ingest"

const NOW = 1_758_620_000_000

describe("correctTimestamp", () => {
  it("trusts clocks within five minutes", () => {
    expect(correctTimestamp(NOW - 1_000, NOW - 60_000, NOW).getTime()).toBe(NOW - 1_000)
  })

  it("shifts timestamps by the batch offset when the clock is wrong", () => {
    const anHourSlow = NOW - 3_600_000
    expect(correctTimestamp(anHourSlow - 5_000, anHourSlow, NOW).getTime()).toBe(NOW - 5_000)
  })

  it("clamps to seven days in the past and one minute in the future", () => {
    expect(correctTimestamp(0, NOW, NOW).getTime()).toBe(NOW - 7 * 24 * 60 * 60_000)
    expect(correctTimestamp(NOW + 3_600_000, NOW, NOW).getTime()).toBe(NOW + 60_000)
  })
})

describe("sanitizeStack", () => {
  it("removes query strings and fragments from frame URLs", () => {
    expect(sanitizeStack("at f (https://x.com/app.js?token=abc#x:10:5)")).toBe(
      "at f (https://x.com/app.js:10:5)"
    )
  })
})

describe("validateEvents", () => {
  it("rejects invalid events individually", () => {
    const result = validateEvents([errorEvent(), { type: "error" }, apiErrorEvent()])
    expect(result.valid).toHaveLength(2)
    expect(result.rejected).toBe(1)
  })

  it("rejects repeated ids within one batch", () => {
    const event = errorEvent()
    expect(validateEvents([event, { ...event }]).rejected).toBe(1)
  })

  it("rejects events over 64 KB before parsing", () => {
    const huge = errorEvent({ tags: { blob: "x".repeat(LIMITS.maxEventBytes) } })
    expect(validateEvents([huge])).toEqual({ valid: [], rejected: 1 })
  })
})

describe("describeIssue", () => {
  it("titles and fingerprints JS errors with the in-app culprit", () => {
    const issue = describeIssue(errorEvent() as never)
    expect(issue.title).toBe("TypeError: Cannot read properties of undefined (reading 'id')")
    expect(issue.culprit).toBe("OrdersTable (/static/app.js)")
    expect(issue.fingerprint).toHaveLength(14)
  })

  it("groups API errors by method, endpoint and status", () => {
    const a = describeIssue(apiErrorEvent(500) as never)
    const b = describeIssue(apiErrorEvent(500) as never)
    const c = describeIssue(apiErrorEvent(503) as never)
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.fingerprint).not.toBe(c.fingerprint)
    expect(a.title).toBe("GET /api/orders/:id → 500")
    expect(describeIssue(apiErrorEvent(0) as never).title).toBe(
      "GET /api/orders/:id → network error"
    )
  })
})

describe("enrichEvents", () => {
  it("sanitizes stacks and leaves non-issue events unfingerprinted", () => {
    const [error] = enrichEvents([errorEvent()], NOW, NOW)
    expect(error?.fingerprint).not.toBeNull()
    expect(JSON.stringify(error?.event.payload)).not.toContain("token=secret")
  })
})
