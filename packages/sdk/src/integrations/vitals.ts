import { onCLS, onFCP, onINP, onLCP, onTTFB, type MetricType } from "web-vitals"

import { getPageContext } from "../context/page"
import type { Integration } from "../hub"

/**
 * Core Web Vitals via Google's `web-vitals` (ADR 19). Values finalize when the
 * page is hidden, which is why the client flushes on visibilitychange.
 * The library offers no unsubscribe, so teardown mutes the callback instead.
 */
export const webVitalsIntegration: Integration = (hub) => {
  let active = true
  // Vitals describe the hard page load, but are often reported later (on input,
  // or when hidden after an SPA navigation). Attribute them to the loaded page.
  const page = getPageContext()
  const report = (metric: MetricType) => {
    if (!active) return
    hub.capture({
      type: "web_vital",
      page,
      payload: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
      },
    })
  }
  onLCP(report)
  onINP(report)
  onCLS(report)
  onFCP(report)
  onTTFB(report)
  return () => {
    active = false
  }
}
