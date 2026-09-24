import type { Environment } from "@traceforge/event-schema/constants"
import { INGEST_KEY_HEADER, LIMITS, SCHEMA_VERSION } from "@traceforge/event-schema/constants"
import type { ErrorEvent, IngestBatch } from "@traceforge/event-schema/types"

import { parseDsn } from "./dsn"
import { uuid } from "./util"

const TIMEOUT_MS = 5_000

export interface WithTraceForgeOptions {
  /** Project DSN from the dashboard: https://<publicKey>@<host>/project/<projectId> */
  dsn: string
  environment?: Environment
  /** Your app's version or commit SHA; enables release comparisons. */
  release?: string
  /** Static tags attached to every reported error. */
  tags?: Readonly<Record<string, string>>
}

/** The subset of Next.js's `instrumentation.ts` onRequestError arguments this reads. */
export interface NextRequestInfo {
  path: string
  method: string
  headers: Record<string, string>
}

export interface NextErrorContext {
  routerKind: "Pages Router" | "App Router"
  routePath: string
  routeType: string
}

/**
 * Wraps Next.js's `onRequestError` hook (`instrumentation.ts`) to report errors from
 * Server Components, Route Handlers and Server Actions — crashes the browser integration
 * never sees. Export the returned function as `onRequestError` from your root
 * `instrumentation.ts`.
 */
export function withTraceForge(options: WithTraceForgeOptions) {
  const dsn = parseDsn(options.dsn)

  return async function onRequestError(
    error: unknown,
    request: NextRequestInfo,
    context: NextErrorContext
  ): Promise<void> {
    if (!dsn) return
    try {
      const err = error instanceof Error ? error : new Error(String(error))
      const event: ErrorEvent = {
        id: uuid(),
        timestamp: Date.now(),
        type: "error",
        environment: options.environment ?? "production",
        ...(options.release && { release: options.release.slice(0, 128) }),
        // No real browser session exists server-side; one per reported error.
        sessionId: uuid(),
        page: { url: request.path, path: request.path, route: context.routePath },
        device: { browser: "server", os: context.routerKind, deviceType: "unknown" },
        ...(options.tags && { tags: options.tags }),
        payload: {
          name: err.name || "ServerError",
          message: (err.message || "Unknown server error").slice(0, LIMITS.maxMessageLength),
          stack: err.stack?.slice(0, LIMITS.maxStackLength),
          mechanism: "server",
          handled: true,
        },
      }
      const batch: IngestBatch = {
        schemaVersion: SCHEMA_VERSION,
        projectId: dsn.projectId,
        sdk: { name: "@traceforge/sdk", version: __SDK_VERSION__ },
        sentAt: Date.now(),
        events: [event],
      }
      await fetch(dsn.ingestUrl, {
        method: "POST",
        headers: { "content-type": "application/json", [INGEST_KEY_HEADER]: dsn.publicKey },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      // Never throw from error reporting — that would mask the real error.
    }
  }
}
