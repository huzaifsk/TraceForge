import type { IngestBatch, MonitoringEvent } from "@traceforge/event-schema/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { close, flush, getClient, init, type TraceForgeOptions } from "./index"

const DSN = "https://pk_test@api.test/project/tf_12345abc"
const INGEST = "https://api.test/api/v1/events"

let appFetch: ReturnType<typeof vi.fn>
let sent: IngestBatch[]

/** Decode a delivered body the way the API does (it may be gzip-compressed). */
async function readBody(body: BodyInit | null | undefined): Promise<IngestBatch> {
  if (typeof body === "string") return JSON.parse(body)
  const stream = new Blob([body as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
  return JSON.parse(await new Response(stream).text())
}

/** Stands in for the network: ingest calls are recorded, app calls return `appStatus`. */
function installFetch(appStatus = 200) {
  sent = []
  appFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith(INGEST)) {
      sent.push(await readBody(init?.body))
      return new Response(null, { status: 202 })
    }
    if (url.includes("unreachable")) throw new TypeError("Failed to fetch")
    return new Response("{}", { status: appStatus })
  })
  window.fetch = appFetch as unknown as typeof fetch
}

const start = (options: Partial<TraceForgeOptions> = {}) =>
  init({
    dsn: DSN,
    // Keep tests deterministic: vitals and timing need a real browser.
    integrations: { webVitals: false, performance: false, navigation: false },
    ...options,
  })

/** An error without a stack stays under 1 KB, so it is sent uncompressed. */
function smallError(message: string) {
  const error = new Error(message)
  error.stack = undefined
  return error
}

const sentEvents = (): MonitoringEvent[] => sent.flatMap((batch) => batch.events)

beforeEach(() => installFetch())
afterEach(async () => {
  await close()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("init", () => {
  it("never throws on bad input and returns an inactive client", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const client = init({ dsn: "nope" })
    expect(client.active).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
  })

  it("is idempotent", () => {
    expect(start()).toBe(start())
  })

  it("installs nothing for unsampled sessions", () => {
    const original = window.fetch
    expect(start({ sampleRate: 0 }).active).toBe(false)
    expect(window.fetch).toBe(original)
  })
})

describe("error capture", () => {
  it("captures uncaught errors with context", async () => {
    start({ release: "v1.2.3", tags: { team: "web" } })

    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new TypeError("Cannot read properties of undefined"),
        message: "x",
      })
    )
    await flush()

    const [event] = sentEvents()
    expect(event).toMatchObject({
      type: "error",
      environment: "production",
      release: "v1.2.3",
      tags: { team: "web" },
      payload: { name: "TypeError", mechanism: "onerror", handled: false },
    })
    expect(event?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(event?.page.path).toBe(location.pathname)
  })

  it("ignores failed resource loads (they are not JS errors)", async () => {
    start()
    const img = document.createElement("img")
    document.body.append(img)
    img.dispatchEvent(new Event("error"))
    await flush()
    expect(sentEvents()).toHaveLength(0)
  })

  it("does not break the host's own error listeners", () => {
    start()
    const hostListener = vi.fn()
    window.addEventListener("error", hostListener)
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("x") }))
    expect(hostListener).toHaveBeenCalledOnce()
  })

  it("captures unhandled rejections of non-Error values", async () => {
    start()
    const event = new Event("unhandledrejection") as PromiseRejectionEvent
    Object.defineProperty(event, "reason", { value: { code: 42 } })
    window.dispatchEvent(event)
    await flush()

    expect(sentEvents()[0]).toMatchObject({
      type: "unhandled_rejection",
      payload: { name: "UnhandledRejection", message: '{"code":42}' },
    })
  })

  it("captureException reports handled errors with tags", async () => {
    const client = start()
    client.captureException(new RangeError("bad"), { tags: { feature: "checkout" } })
    await flush()
    expect(sentEvents()[0]).toMatchObject({
      payload: { name: "RangeError", mechanism: "manual", handled: true },
      tags: { feature: "checkout" },
    })
  })

  it("honors ignoreErrors and beforeSend, and survives a throwing beforeSend", async () => {
    start({
      ignoreErrors: [/ResizeObserver/],
      beforeSend: (event) => {
        if (event.type === "error" && event.payload.message === "drop me") return null
        if (event.type === "error" && event.payload.message === "explode") throw new Error("oops")
        return event
      },
    })
    const client = getClient()!
    client.captureException(new Error("ResizeObserver loop limit exceeded"))
    client.captureException(new Error("drop me"))
    client.captureException(new Error("explode"))
    client.captureException(new Error("keep me"))
    await flush()

    expect(sentEvents().map((e) => e.type === "error" && e.payload.message)).toEqual([
      "explode",
      "keep me",
    ])
  })

  it("collapses error loops", async () => {
    const client = start()
    for (let i = 0; i < 50; i++) client.captureException(new Error("loop"))
    await flush()
    expect(sentEvents()).toHaveLength(10)
  })
})

describe("fetch instrumentation", () => {
  it("records failing requests as api_error with a redacted URL", async () => {
    installFetch(500)
    start()

    const response = await window.fetch("https://shop.test/api/orders/42?token=secret", {
      method: "post",
    })
    expect(response.status).toBe(500) // the host sees the real response
    await flush()

    expect(sentEvents()[0]).toMatchObject({
      type: "api_error",
      payload: {
        method: "POST",
        endpoint: "/api/orders/:id",
        url: "https://shop.test/api/orders/42?token=[redacted]",
        status: 500,
        errorKind: "http",
        transport: "fetch",
      },
    })
  })

  it("records network failures and re-throws the original error", async () => {
    start()
    await expect(window.fetch("https://unreachable.test/")).rejects.toThrow("Failed to fetch")
    await flush()
    expect(sentEvents()[0]).toMatchObject({
      type: "api_error",
      payload: { status: 0, errorKind: "network" },
    })
  })

  it("records successful requests and never its own deliveries", async () => {
    start({ batchSize: 1 })
    await window.fetch("https://shop.test/api/profile")
    await flush()
    await flush()

    const types = sentEvents().map((e) => e.type)
    expect(types).toEqual(["api_request"])
  })

  it("ignores Next.js RSC and prefetch requests", async () => {
    start()
    await window.fetch("https://shop.test/orders/123?_rsc=1x7ab")
    await window.fetch("https://shop.test/api/orders")
    await flush()
    const endpoints = sentEvents().map((e) => ("endpoint" in e.payload ? e.payload.endpoint : null))
    expect(endpoints).toEqual(["/api/orders"])
  })

  it("restores window.fetch on close", async () => {
    const original = window.fetch
    start()
    expect(window.fetch).not.toBe(original)
    await close()
    expect(window.fetch).toBe(original)
  })
})

describe("navigation", () => {
  it("records SPA route changes and restores history on close", async () => {
    const nativePush = history.pushState
    start({ integrations: { webVitals: false, performance: false } })

    history.pushState({}, "", "/orders/123")
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flush()

    const nav = sentEvents().filter((e) => e.type === "navigation")
    expect(nav.at(-1)).toMatchObject({ payload: { to: "/orders/123", kind: "push" } })
    await close()
    expect(history.pushState).toBe(nativePush)
  })
})

describe("batching and delivery", () => {
  it("flushes when the batch size is reached", async () => {
    const client = start({ batchSize: 3, flushIntervalMs: 60_000 })
    client.captureException(new Error("a"))
    client.captureException(new Error("b"))
    expect(sent).toHaveLength(0)
    client.captureException(new Error("c"))
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.events).toHaveLength(3)
  })

  it("flushes after the interval", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    const client = start({ flushIntervalMs: 5_000 })
    client.captureException(smallError("a"))
    await vi.advanceTimersByTimeAsync(4_999)
    expect(sent).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(sent).toHaveLength(1)
  })

  it("retries with exponential backoff after a server error", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    let calls = 0
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith(INGEST)) {
        calls++
        if (calls < 3) return new Response(null, { status: 503 })
        sent.push(await readBody(init?.body))
        return new Response(null, { status: 202 })
      }
      return new Response("{}")
    }) as unknown as typeof fetch

    const client = start({ flushIntervalMs: 10 })
    client.captureException(smallError("a"))
    await vi.advanceTimersByTimeAsync(10) // first attempt fails
    expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(1_300) // ~1s backoff (+/-20% jitter)
    expect(calls).toBe(2)
    await vi.advanceTimersByTimeAsync(2_500) // ~2s backoff
    expect(calls).toBe(3)
    expect(sent).toHaveLength(1)
  })

  it("delivers via sendBeacon when the page is hidden", async () => {
    const beacon = vi.fn(() => true)
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
    const client = start({ flushIntervalMs: 60_000 })
    client.captureException(new Error("a"))

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })

    expect(beacon).toHaveBeenCalledOnce()
    expect(String((beacon.mock.calls[0] as unknown as [string])[0])).toContain("key=pk_test")
  })
})

describe("privacy", () => {
  it("omits the anonymous id unless user context is enabled", async () => {
    const client = start()
    client.captureException(new Error("a"))
    await flush()
    expect(sentEvents()[0]?.anonymousId).toBeUndefined()
    expect(sentEvents()[0]?.sessionId).toBeTruthy()
  })

  it("adds a stable anonymous id when opted in", async () => {
    const client = start({ privacy: { captureUserContext: true } })
    client.captureException(new Error("a"))
    client.captureException(new Error("b"))
    await flush()
    const [a, b] = sentEvents()
    expect(a?.anonymousId).toBeTruthy()
    expect(a?.anonymousId).toBe(b?.anonymousId)
  })
})
