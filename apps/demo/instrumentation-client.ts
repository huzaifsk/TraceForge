import { init } from "@traceforge/sdk"

/**
 * Runs before the demo hydrates (Next.js instrumentation-client), exactly how a
 * real app would install TraceForge. `beforeSend` also feeds the on-page session
 * log so visitors can watch what the SDK captures.
 */
const dsn = process.env.NEXT_PUBLIC_TRACEFORGE_DSN

if (dsn) {
  init({
    dsn,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    release: "demo",
    flushIntervalMs: 1_000,
    debug: process.env.NODE_ENV !== "production",
    beforeSend(event) {
      window.dispatchEvent(new CustomEvent("traceforge:captured", { detail: event }))
      return event
    },
  })
} else {
  console.warn("[demo] NEXT_PUBLIC_TRACEFORGE_DSN is not set; TraceForge is disabled.")
}
