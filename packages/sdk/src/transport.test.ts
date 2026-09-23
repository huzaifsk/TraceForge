import type { MonitoringEvent } from "@pulseed/event-schema/types"
import { afterEach, describe, expect, it, vi } from "vitest"

import { parseDsn } from "./dsn"
import { createTransport } from "./transport"

const dsn = parseDsn("https://pk_test@api.test/project/pw_12345abc")!
const sdk = { name: "@pulseed/sdk", version: "0.0.0" }

const event = (tag = "") =>
  ({
    id: crypto.randomUUID(),
    timestamp: 1,
    environment: "production",
    sessionId: "s",
    page: { url: "https://x.test/", path: "/" },
    device: { browser: "Chrome", os: "macOS", deviceType: "desktop" },
    tags: { tag },
    type: "navigation",
    payload: { to: "/", kind: "initial" },
  }) as MonitoringEvent

const respond = (status: number, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(null, { status, headers }))

afterEach(() => vi.restoreAllMocks())

describe("transport", () => {
  it("posts a text/plain batch with the key in the query string", async () => {
    const fetchMock = respond(202)
    const result = await createTransport(dsn, sdk, fetchMock).send([event()])

    expect(result).toEqual({ status: "ok" })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.test/api/v1/events?key=pk_test")
    expect(init.headers).toEqual({ "content-type": "text/plain;charset=UTF-8" })
    expect(init.credentials).toBe("omit")
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toMatchObject({
      projectId: "pw_12345abc",
      schemaVersion: 1,
      sdk,
    })
  })

  it.each([
    [500, "retry"],
    [503, "retry"],
    [429, "retry"],
    [400, "drop"],
    [401, "drop"],
    [413, "drop"],
  ])("HTTP %i → %s", async (status, expected) => {
    const result = await createTransport(dsn, sdk, respond(status)).send([event()])
    expect(result.status).toBe(expected)
  })

  it("honors Retry-After on 429", async () => {
    const result = await createTransport(dsn, sdk, respond(429, { "retry-after": "7" })).send([
      event(),
    ])
    expect(result).toEqual({ status: "retry", retryAfterMs: 7_000 })
  })

  it("retries on network failure", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    expect((await createTransport(dsn, sdk, failing).send([event()])).status).toBe("retry")
  })

  it("gzips large bodies when CompressionStream exists", async () => {
    if (typeof CompressionStream === "undefined") return
    const fetchMock = respond(202)
    const events = Array.from({ length: 30 }, () => event("x".repeat(100)))
    await createTransport(dsn, sdk, fetchMock).send(events)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain("&enc=gzip")
    expect(init.body).toBeInstanceOf(ArrayBuffer)
  })

  it("uses sendBeacon on unload, splitting batches under 60 KB", async () => {
    const beacon = vi.fn(() => true)
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
    const fetchMock = respond(202)
    const events = Array.from({ length: 40 }, () => event("y".repeat(3_000)))

    await createTransport(dsn, sdk, fetchMock).send(events, { unload: true })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(beacon.mock.calls.length).toBeGreaterThan(1)
    for (const call of beacon.mock.calls as unknown as [string, Blob][]) {
      expect(call[1].size).toBeLessThan(60_000)
    }
  })

  it("recognizes its own requests", () => {
    const transport = createTransport(dsn, sdk, respond(202))
    expect(transport.isOwnRequest("https://api.test/api/v1/events?key=x")).toBe(true)
    expect(transport.isOwnRequest("https://api.test/api/orders")).toBe(false)
  })
})
