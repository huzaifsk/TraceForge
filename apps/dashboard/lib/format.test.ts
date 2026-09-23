import { describe, expect, it } from "vitest"

import {
  computeDelta,
  formatCompact,
  formatCount,
  formatDuration,
  formatPercent,
  formatRelative,
  formatVital,
  truncateMiddle,
} from "./format"

describe("formatters", () => {
  it.each([
    [0, "0 ms"],
    [142.4, "142 ms"],
    [999.6, "1000 ms"],
    [1_820, "1.82 s"],
    [90_000, "1.5 min"],
  ])("formatDuration(%d) = %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })

  it("renders missing values as an em dash", () => {
    expect(formatDuration(null)).toBe("—")
    expect(formatVital("LCP", null)).toBe("—")
  })

  it("formats CLS unitless and other vitals as durations", () => {
    expect(formatVital("CLS", 0.034)).toBe("0.03")
    expect(formatVital("INP", 142)).toBe("142 ms")
  })

  it("formats counts exactly and compactly", () => {
    expect(formatCount(12_421)).toBe("12,421")
    expect(formatCompact(318)).toBe("318")
    expect(formatCompact(12_421)).toBe("12.4K")
  })

  it.each([
    [0, "0%"],
    [0.0067, "0.67%"],
    [0.05, "5%"],
    [0.125, "13%"],
    [0.9996, "99.9%"],
    [1, "100%"],
  ])("formatPercent(%d) = %s", (ratio, text) => {
    expect(formatPercent(ratio)).toBe(text)
  })

  it("computes deltas and handles a zero baseline", () => {
    expect(computeDelta(142, 100)).toEqual({ ratio: 0.42, direction: "up" })
    expect(computeDelta(50, 100)).toEqual({ ratio: -0.5, direction: "down" })
    expect(computeDelta(5, 0)).toEqual({ ratio: null, direction: "up" })
    expect(computeDelta(0, 0)).toEqual({ ratio: null, direction: "flat" })
  })

  it("formats relative times", () => {
    const now = Date.parse("2026-09-23T12:00:00Z")
    expect(formatRelative(now - 10_000, now)).toBe("just now")
    expect(formatRelative(now - 3 * 60_000, now)).toBe("3m ago")
    expect(formatRelative(now - 2 * 86_400_000, now)).toBe("2d ago")
  })

  it("truncates the middle of long strings", () => {
    const value = truncateMiddle("/api/v1/organizations/acme/projects/web/releases/latest", 24)
    expect(value).toHaveLength(24)
    expect(value.startsWith("/api/v1/org")).toBe(true)
    expect(value.endsWith("latest")).toBe(true)
  })
})
