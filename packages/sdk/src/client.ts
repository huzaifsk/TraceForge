import { LIMITS, SDK_DEFAULTS } from "@traceforge/event-schema/constants"
import type { DeviceContext, MonitoringEvent } from "@traceforge/event-schema/types"

import { getDeviceContext } from "./context/device"
import { getPageContext } from "./context/page"
import { getAnonymousId, getSessionId } from "./context/session"
import type { Hub, Integration, Teardown } from "./hub"
import { errorsIntegration, rejectionsIntegration, toErrorPayload } from "./integrations/errors"
import { fetchIntegration, xhrIntegration } from "./integrations/http"
import { navigationIntegration } from "./integrations/navigation"
import { performanceIntegration } from "./integrations/performance"
import { webVitalsIntegration } from "./integrations/vitals"
import type { ResolvedOptions } from "./options"
import { dedupeKey, Deduper, type EventDraft, limitTags, prepareEvent } from "./pipeline"
import { createTransport, type Transport } from "./transport"
import { matches, safely, uuid } from "./util"

/** Low-value events are evicted first when the queue overflows; errors last. */
const EVICTABLE = new Set<MonitoringEvent["type"]>(["api_request", "navigation", "performance"])
const FLUSH_TIMEOUT_MS = 2_000

interface PendingBatch {
  events: MonitoringEvent[]
  attempt: number
}

export interface CaptureContext {
  tags?: Readonly<Record<string, string>>
}

export interface Client {
  readonly active: boolean
  readonly options: Readonly<ResolvedOptions>
  capture(draft: EventDraft): void
  captureException(error: unknown, context?: CaptureContext): void
  setTag(key: string, value: string): void
  flush(): Promise<void>
  close(): Promise<void>
}

export function createClient(
  options: ResolvedOptions,
  sdk: { name: string; version: string }
): Client {
  const log = (...args: unknown[]) => {
    // eslint-disable-next-line no-console -- opt-in diagnostics (`debug: true`)
    if (options.debug) console.info("[TraceForge]", ...args)
  }

  // Capture the native fetch before instrumentation, so our own deliveries are never recorded.
  const nativeFetch = typeof window.fetch === "function" ? window.fetch : undefined
  const transport: Transport = createTransport(
    options.dsn,
    sdk,
    nativeFetch && ((input, init) => nativeFetch.call(window, input, init))
  )

  const sessionId = getSessionId()
  const anonymousId = options.privacy.captureUserContext ? getAnonymousId() : undefined
  let device: DeviceContext | undefined
  const scopeTags: Record<string, string> = { ...options.tags }
  const deduper = new Deduper()

  let active = true
  let queue: MonitoringEvent[] = []
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  const retryTimers = new Set<ReturnType<typeof setTimeout>>()
  /** Batches waiting for the network to come back (in memory; IndexedDB is Phase 2). */
  let offline: MonitoringEvent[] = []
  const inFlight = new Set<Promise<unknown>>()

  function buildEvent(draft: EventDraft): MonitoringEvent {
    device ??= getDeviceContext()
    const tags = limitTags({ ...scopeTags, ...draft.tags })
    return {
      id: uuid(),
      timestamp: draft.timestamp ?? Date.now(),
      environment: options.environment,
      ...(options.release && { release: options.release.slice(0, 128) }),
      sessionId,
      ...(anonymousId && { anonymousId }),
      page: draft.page ?? getPageContext(),
      device,
      ...(Object.keys(tags).length > 0 && { tags }),
      type: draft.type,
      payload: draft.payload,
    } as MonitoringEvent
  }

  function enqueue(event: MonitoringEvent): void {
    queue.push(event)
    if (queue.length > SDK_DEFAULTS.maxQueueSize) {
      const index = queue.findIndex((e) => EVICTABLE.has(e.type))
      queue.splice(index === -1 ? 0 : index, 1)
    }
    if (queue.length >= options.batchSize) void flush()
    else flushTimer ??= setTimeout(() => void flush(), options.flushIntervalMs)
  }

  function capture(draft: EventDraft): void {
    if (!active) return
    try {
      const event = buildEvent(draft)
      if (
        (event.type === "error" || event.type === "unhandled_rejection") &&
        matches(event.payload.message, options.ignoreErrors)
      ) {
        return
      }

      let prepared = prepareEvent(event)
      if (!prepared) return log("dropped an event larger than 64 KB", event.type)

      if (options.beforeSend) {
        try {
          const result = options.beforeSend(prepared)
          if (result === null) return
          if (result) prepared = result
        } catch (error) {
          log("beforeSend threw; sending the original event", error)
        }
      }

      const key = dedupeKey(prepared)
      if (key && !deduper.allow(key)) return

      enqueue(prepared)
    } catch (error) {
      log("failed to capture an event", error)
    }
  }

  function backoff(attempt: number, retryAfterMs?: number): number {
    const exponential = SDK_DEFAULTS.retryBaseDelayMs * 2 ** attempt
    const jitter = exponential * 0.2 * (Math.random() * 2 - 1)
    return Math.max(retryAfterMs ?? 0, exponential + jitter)
  }

  function holdOffline(events: readonly MonitoringEvent[]): void {
    offline = [...offline, ...events].slice(-SDK_DEFAULTS.maxOfflineEvents)
  }

  async function deliver(batch: PendingBatch): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return holdOffline(batch.events)
    }
    const result = await transport.send(batch.events)
    if (result.status === "ok") return log(`sent ${batch.events.length} event(s)`)
    if (result.status === "drop") return log(`dropped a batch: ${result.reason}`)

    if (batch.attempt >= options.maxRetries) {
      log(`giving up after ${batch.attempt} retries; holding for reconnect`)
      return holdOffline(batch.events)
    }
    const timer = setTimeout(
      () => {
        retryTimers.delete(timer)
        track(deliver({ events: batch.events, attempt: batch.attempt + 1 }))
      },
      backoff(batch.attempt, result.retryAfterMs)
    )
    retryTimers.add(timer)
  }

  function track(promise: Promise<unknown>): void {
    const settled = promise.catch(() => {}).finally(() => inFlight.delete(settled))
    inFlight.add(settled)
  }

  function takeQueue(): MonitoringEvent[] {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = undefined
    const events = queue
    queue = []
    return events
  }

  async function flush(): Promise<void> {
    const events = takeQueue()
    for (let i = 0; i < events.length; i += LIMITS.maxEventsPerBatch) {
      track(deliver({ events: events.slice(i, i + LIMITS.maxEventsPerBatch), attempt: 0 }))
    }
    const pending = Promise.all(inFlight)
    await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS))])
  }

  /** The page may be going away: hand everything to sendBeacon synchronously. */
  function flushForUnload(): void {
    const events = [...offline, ...takeQueue()]
    offline = []
    for (let i = 0; i < events.length; i += LIMITS.maxEventsPerBatch) {
      void transport.send(events.slice(i, i + LIMITS.maxEventsPerBatch), { unload: true })
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === "hidden") flushForUnload()
  }
  const onOnline = () => {
    const events = offline
    offline = []
    for (let i = 0; i < events.length; i += LIMITS.maxEventsPerBatch) {
      track(deliver({ events: events.slice(i, i + LIMITS.maxEventsPerBatch), attempt: 0 }))
    }
  }
  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("pagehide", flushForUnload)
  window.addEventListener("online", onOnline)

  const hub: Hub = { options, capture, isOwnRequest: transport.isOwnRequest }
  const integrations: Array<[name: string, enabled: boolean, setup: Integration]> = [
    ["errors", options.integrations.errors, errorsIntegration],
    ["unhandledRejections", options.integrations.unhandledRejections, rejectionsIntegration],
    ["fetch", options.integrations.fetch && !!nativeFetch, fetchIntegration(nativeFetch!)],
    ["xhr", options.integrations.xhr && typeof XMLHttpRequest !== "undefined", xhrIntegration],
    ["webVitals", options.integrations.webVitals, webVitalsIntegration],
    ["navigation", options.integrations.navigation, navigationIntegration],
    ["performance", options.integrations.performance, performanceIntegration],
  ]
  const teardowns: Teardown[] = []
  for (const [name, enabled, setup] of integrations) {
    if (!enabled) continue
    try {
      teardowns.push(setup(hub))
    } catch (error) {
      log(`integration "${name}" failed to start and was skipped`, error)
    }
  }
  log("initialized", { projectId: options.dsn.projectId, environment: options.environment })

  return {
    get active() {
      return active
    },
    options,
    capture,
    captureException(error, context) {
      capture({
        type: "error",
        payload: toErrorPayload(error, "manual", true),
        ...(context?.tags && { tags: context.tags }),
      })
    },
    setTag(key, value) {
      scopeTags[key] = String(value)
    },
    flush,
    async close() {
      if (!active) return
      for (const teardown of teardowns.reverse()) safely(teardown)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", flushForUnload)
      window.removeEventListener("online", onOnline)
      await flush()
      for (const timer of retryTimers) clearTimeout(timer)
      retryTimers.clear()
      active = false
    },
  }
}
