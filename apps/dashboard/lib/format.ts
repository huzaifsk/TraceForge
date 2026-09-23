import type { WebVitalName } from "@pulseed/event-schema/constants"

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

/** Exact counts for tables: 1,284. */
export const formatCount = (value: number) => integer.format(value)

/** Short counts for tiles and axes: 12.4K. */
export const formatCompact = (value: number) =>
  Math.abs(value) < 1_000 ? integer.format(value) : compact.format(value)

/** 142 ms below one second, 1.82 s above. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—"
  if (ms < 1_000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(2)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}

/** A Web Vital in its natural unit: CLS is unitless with 2 decimals, the rest are durations. */
export function formatVital(name: WebVitalName, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return name === "CLS" ? value.toFixed(2) : formatDuration(value)
}

/** Ratio 0–1 as a percentage: 0.67%, 12.5%, 100%. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "—"
  const percent = ratio * 100
  if (percent === 0) return "0%"
  if (percent < 1) return `${percent.toPrecision(2)}%`
  if (percent >= 99.95 && percent < 100) return "99.9%"
  return `${percent.toFixed(percent >= 10 ? 0 : 1).replace(/\.0$/, "")}%`
}

export interface Delta {
  /** Relative change, e.g. 0.42 for +42%. null when there is no baseline. */
  ratio: number | null
  direction: "up" | "down" | "flat"
}

/** Change from the previous period. */
export function computeDelta(value: number, previous: number): Delta {
  if (previous === 0) return { ratio: null, direction: value === 0 ? "flat" : "up" }
  const ratio = (value - previous) / previous
  return { ratio, direction: Math.abs(ratio) < 0.005 ? "flat" : ratio > 0 ? "up" : "down" }
}

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3_600_000],
  ["month", 30 * 24 * 3_600_000],
  ["week", 7 * 24 * 3_600_000],
  ["day", 24 * 3_600_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

/** "3m ago", "2d ago", "just now". */
export function formatRelative(date: string | number | Date, now = Date.now()): string {
  const diff = now - new Date(date).getTime()
  if (diff < 45_000) return "just now"
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (diff >= ms) {
      const value = Math.floor(diff / ms)
      const short = { year: "y", month: "mo", week: "w", day: "d", hour: "h", minute: "m" }[
        unit as string
      ]
      return `${value}${short} ago`
    }
  }
  return "just now"
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})
const dateOnly = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})
const timeOnly = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

/** Absolute local time for tooltips: "Sep 23, 2:41 PM". */
export const formatDateTime = (date: string | number | Date) => dateTime.format(new Date(date))
export const formatDate = (date: string | number | Date) => dateOnly.format(new Date(date))
/** 24-hour clock with seconds for the live stream: 14:32:21. */
export const formatClock = (date: string | number | Date) => timeOnly.format(new Date(date))

/** Axis label for a bucket start, sized to the bucket width. */
export function formatBucket(t: number, bucketMs: number): string {
  const date = new Date(t)
  if (bucketMs < 3_600_000) return timeOnly.format(date).slice(0, 5)
  if (bucketMs < 24 * 3_600_000) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
    }).format(date)
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
}

/** Truncate the middle of long paths, keeping both ends readable. */
export function truncateMiddle(value: string, max = 48): string {
  if (value.length <= max) return value
  const keep = max - 1
  const head = Math.ceil(keep / 2)
  return `${value.slice(0, head)}…${value.slice(value.length - (keep - head))}`
}
