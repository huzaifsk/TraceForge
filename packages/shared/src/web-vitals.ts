import type { WebVitalName, WebVitalRating } from "@traceforge/event-schema/constants"

/**
 * Official Core Web Vitals thresholds (web.dev). A value <= `good` is good,
 * <= `poor` needs improvement, anything above is poor.
 * Units: milliseconds, except CLS which is unitless.
 */
export const WEB_VITAL_THRESHOLDS: Record<WebVitalName, { good: number; poor: number }> = {
  LCP: { good: 2_500, poor: 4_000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1_800, poor: 3_000 },
  TTFB: { good: 800, poor: 1_800 },
}

export function rateWebVital(name: WebVitalName, value: number): WebVitalRating {
  const { good, poor } = WEB_VITAL_THRESHOLDS[name]
  if (value <= good) return "good"
  if (value <= poor) return "needs-improvement"
  return "poor"
}
