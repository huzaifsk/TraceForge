import { withTraceForge } from "@traceforge/sdk/next"

/**
 * Server-side counterpart to instrumentation-client.ts: reports crashes in Server
 * Components, Route Handlers and Server Actions, which the browser SDK never sees.
 */
const dsn = process.env.NEXT_PUBLIC_TRACEFORGE_DSN

export const onRequestError = dsn
  ? withTraceForge({
      dsn,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      release: "demo",
    })
  : undefined
