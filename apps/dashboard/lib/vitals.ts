import type { WebVitalName } from "@pulseed/event-schema/constants"
import { WEB_VITAL_THRESHOLDS } from "@pulseed/shared"

import { formatVital } from "./format"

export const VITAL_INFO: Record<WebVitalName, { label: string; description: string }> = {
  LCP: { label: "Largest Contentful Paint", description: "Loading: when the main content appears" },
  INP: {
    label: "Interaction to Next Paint",
    description: "Responsiveness to clicks, taps and keys",
  },
  CLS: { label: "Cumulative Layout Shift", description: "Visual stability while the page loads" },
  FCP: { label: "First Contentful Paint", description: "When anything first appears" },
  TTFB: { label: "Time to First Byte", description: "Server and network response time" },
}

/** "Good ≤ 2.50 s". */
export const goodThreshold = (name: WebVitalName) =>
  `Good ≤ ${formatVital(name, WEB_VITAL_THRESHOLDS[name].good)}`

export const thresholdsFor = (name: WebVitalName) => [
  { value: WEB_VITAL_THRESHOLDS[name].good, label: "Good" },
  { value: WEB_VITAL_THRESHOLDS[name].poor, label: "Poor" },
]
