import { type CaptureContext, type Client, createClient } from "./client"
import { type TraceForgeOptions, type ResolvedOptions, resolveOptions } from "./options"

export type { CaptureContext } from "./client"
export type { IntegrationOptions, PrivacyOptions, TraceForgeOptions } from "./options"
export type { Environment, EventType } from "@traceforge/event-schema/constants"
export type * from "@traceforge/event-schema/types"

export const SDK_NAME = "@traceforge/sdk"
export const SDK_VERSION: string = __SDK_VERSION__

export interface TraceForgeClient {
  /** True when the SDK is configured and sampling this session. */
  readonly active: boolean
  /** Resolved configuration, or null when init failed. */
  readonly options: Readonly<ResolvedOptions> | null
  /** Report a caught error (mechanism "manual", handled). */
  captureException(error: unknown, context?: CaptureContext): void
  /** Attach a tag to every subsequent event. */
  setTag(key: string, value: string): void
  /** Send queued events now; resolves when delivery settles (or after 2 s). */
  flush(): Promise<void>
  /** Remove all instrumentation, flush, and allow `init` to be called again. */
  close(): Promise<void>
}

const noop: TraceForgeClient = {
  active: false,
  options: null,
  captureException: () => {},
  setTag: () => {},
  flush: async () => {},
  close: async () => {},
}

let client: Client | null = null
let publicClient: TraceForgeClient | null = null

function wrap(inner: Client): TraceForgeClient {
  return {
    get active() {
      return inner.active
    },
    options: inner.options,
    captureException: (error, context) => inner.captureException(error, context),
    setTag: (key, value) => inner.setTag(key, value),
    flush: () => inner.flush(),
    close: async () => {
      await inner.close()
      if (client === inner) {
        client = null
        publicClient = null
      }
    },
  }
}

/**
 * Initialize TraceForge. Call once, as early as possible in your app — in
 * Next.js, from `instrumentation-client.ts`.
 *
 * The SDK never throws into the host application: invalid configuration logs
 * a single warning and returns an inactive client. On the server it is a no-op.
 */
export function init(options: TraceForgeOptions): TraceForgeClient {
  if (typeof window === "undefined" || typeof document === "undefined") return noop
  if (publicClient) {
    if (publicClient.options?.debug) console.warn("[TraceForge] init() called twice; ignoring.")
    return publicClient
  }

  try {
    const result = resolveOptions(options)
    if (!result.ok) {
      console.warn(`[TraceForge] ${result.error} Monitoring is disabled.`)
      return noop
    }

    const resolved = result.options
    // Sampling is decided once per page load; unsampled sessions install nothing.
    if (!resolved.enabled || Math.random() >= resolved.sampleRate) {
      publicClient = {
        ...noop,
        options: resolved,
        close: async () => {
          publicClient = null
        },
      }
      return publicClient
    }

    client = createClient(resolved, { name: SDK_NAME, version: SDK_VERSION })
    publicClient = wrap(client)
    return publicClient
  } catch (error) {
    console.warn("[TraceForge] Failed to initialize; monitoring is disabled.", error)
    return noop
  }
}

/** The active client, or null before `init` (or after `close`). */
export function getClient(): TraceForgeClient | null {
  return publicClient
}

/** Report a caught error through the active client. Safe to call before `init`. */
export function captureException(error: unknown, context?: CaptureContext): void {
  publicClient?.captureException(error, context)
}

/** Attach a tag to every subsequent event. Safe to call before `init`. */
export function setTag(key: string, value: string): void {
  publicClient?.setTag(key, value)
}

/** Send queued events now. */
export function flush(): Promise<void> {
  return publicClient?.flush() ?? Promise.resolve()
}

/** Remove instrumentation and flush. */
export function close(): Promise<void> {
  return publicClient?.close() ?? Promise.resolve()
}
