import { randomUUID } from "node:crypto"
import { request as httpRequest } from "node:http"
import type { AddressInfo } from "node:net"

import type { MonitoringEvent } from "@traceforge/event-schema/types"
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest"

import type { App } from "../app"
import {
  apiErrorEvent,
  batch,
  createProject,
  createTestApp,
  errorEvent,
  resetDatabase,
  signUp,
  type TestProject,
} from "../test/helpers"

const ctx = (overrides: Partial<MonitoringEvent> = {}) => ({
  environment: "production" as const,
  sessionId: "s1",
  page: { url: "https://shop.example.com/orders/42", path: "/orders/42" },
  device: { browser: "Chrome", os: "macOS", deviceType: "desktop" as const },
  id: randomUUID(),
  timestamp: Date.now() - 60_000,
  ...overrides,
})

const apiRequest = (endpoint: string, durationMs: number, status = 200): MonitoringEvent =>
  ({
    ...ctx(),
    type: status >= 400 ? "api_error" : "api_request",
    payload: {
      method: "GET",
      url: `https://shop.example.com${endpoint}`,
      endpoint,
      status,
      durationMs,
      transport: "fetch",
      ...(status >= 400 && { errorKind: "http" }),
    },
  }) as MonitoringEvent

const vital = (name: "LCP" | "INP" | "CLS", value: number, rating: string, path = "/orders/42") =>
  ({
    ...ctx({ page: { url: `https://shop.example.com${path}`, path } }),
    type: "web_vital",
    payload: { name, value, rating, delta: value },
  }) as MonitoringEvent

describe.skipIf(!inject("dbAvailable"))("analytics", () => {
  let app: App
  let cookie: string
  let project: TestProject

  beforeAll(async () => {
    app = await createTestApp()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    ;({ cookie } = await signUp(app))
    project = await createProject(app, cookie)
  })
  afterAll(() => app.close())

  const ingest = async (events: unknown[]) => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/events?key=${project.publicKey}`,
      headers: { "content-type": "text/plain" },
      payload: JSON.stringify(batch(project.id, events)),
    })
    expect(response.statusCode).toBe(202)
  }

  const get = async (path: string) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}${path}`,
      headers: { cookie },
    })
    expect(response.statusCode, response.body).toBe(200)
    return response.json()
  }

  it("computes overview KPIs, trend, vitals and endpoints", async () => {
    await ingest([
      errorEvent({ sessionId: "s1" }),
      errorEvent({ sessionId: "s1" }),
      errorEvent({ sessionId: "s2" }),
      apiRequest("/api/orders", 100),
      apiRequest("/api/orders", 300),
      apiRequest("/api/payment", 900, 500),
      { ...ctx({ sessionId: "s3" }), type: "navigation", payload: { to: "/", kind: "initial" } },
      vital("LCP", 1_000, "good"),
      vital("LCP", 3_000, "needs-improvement"),
      vital("LCP", 5_000, "poor"),
      vital("CLS", 0.02, "good"),
    ])

    const overview = await get("/overview?range=24h")

    expect(overview.kpis.errors.value).toBe(3)
    expect(overview.kpis.apiFailures.value).toBe(1)
    expect(overview.kpis.users.value).toBe(3) // s1, s2, s3
    expect(overview.kpis.errorRate.value).toBeCloseTo(2 / 3) // s1 and s2 had errors
    expect(overview.trend).toHaveLength(48)
    expect(overview.trend.reduce((n: number, p: { errors: number }) => n + p.errors, 0)).toBe(3)

    const lcp = overview.vitals.find((v: { name: string }) => v.name === "LCP")
    expect(lcp).toMatchObject({
      samples: 3,
      rating: "needs-improvement",
      distribution: { good: 1, "needs-improvement": 1, poor: 1 },
    })
    expect(lcp.p75).toBe(4_000) // percentile_cont interpolates 3000 → 5000
    expect(overview.vitals.find((v: { name: string }) => v.name === "INP")).toMatchObject({
      p75: null,
      samples: 0,
    })

    expect(overview.topIssues[0]).toMatchObject({ events: 3, users: 2, type: "error" })
    expect(overview.topIssues[0].sparkline).toHaveLength(24)
    expect(overview.slowestEndpoints[0]).toMatchObject({ endpoint: "/api/payment", requests: 1 })
    expect(overview.failingEndpoints).toEqual([
      { method: "GET", endpoint: "/api/payment", requests: 1, errors: 1 },
    ])
  })

  it("filters by environment", async () => {
    await ingest([errorEvent(), errorEvent({ environment: "staging" })])
    expect((await get("/overview?environment=staging")).kpis.errors.value).toBe(1)
    expect((await get("/overview")).kpis.errors.value).toBe(2)
  })

  it("lists issues with search, status, sort and in-range counts", async () => {
    await ingest([
      errorEvent(),
      errorEvent(),
      apiErrorEvent(500),
      errorEvent({
        payload: {
          name: "ChunkLoadError",
          message: "Loading chunk 42 failed",
          mechanism: "onerror",
          handled: false,
        },
      } as never),
    ])

    const all = await get("/issues?sort=events")
    expect(all.issues.map((i: { title: string }) => i.title)).toEqual([
      "TypeError: Cannot read properties of undefined (reading 'id')",
      expect.stringMatching(/ChunkLoadError|GET \/api\/orders/),
      expect.stringMatching(/ChunkLoadError|GET \/api\/orders/),
    ])
    expect(all.issues[0]).toMatchObject({ events: 2, totalEvents: 2, status: "unresolved" })
    expect(all.browsers).toEqual(["Chrome"])

    const searched = await get("/issues?q=chunk")
    expect(searched.issues).toHaveLength(1)

    // LIKE wildcards in the search are literal, not patterns.
    expect((await get("/issues?q=%25")).issues).toHaveLength(0)

    const id = all.issues[0].id
    const patched = await app.inject({
      method: "PATCH",
      url: `/api/v1/projects/${project.id}/issues/${id}`,
      headers: { cookie },
      payload: { status: "resolved" },
    })
    expect(patched.json()).toEqual({ id, status: "resolved" })
    expect((await get("/issues")).issues).toHaveLength(2)
    expect((await get("/issues?status=resolved")).issues).toHaveLength(1)
  })

  it("returns issue detail with parsed frames and breakdowns", async () => {
    await ingest([
      errorEvent(),
      errorEvent({ device: { browser: "Firefox", os: "Windows", deviceType: "desktop" } } as never),
    ])
    const [{ id }] = (await get("/issues")).issues

    const detail = await get(`/issues/${id}`)

    expect(detail.events).toBe(2)
    expect(detail.latestEvent.frames[0]).toMatchObject({
      function: "OrdersTable",
      line: 124,
      inApp: true,
    })
    expect(detail.latestEvent.stack).not.toContain("token=secret")
    expect(detail.breakdowns.browser).toEqual(
      expect.arrayContaining([
        { value: "Chrome", count: 1 },
        { value: "Firefox", count: 1 },
      ])
    )
    expect(detail.breakdowns.path).toEqual([{ value: "/orders", count: 2 }])
  })

  it("aggregates API endpoints and endpoint detail", async () => {
    await ingest([
      apiRequest("/api/orders", 100),
      apiRequest("/api/orders", 200),
      apiRequest("/api/orders", 300),
      apiRequest("/api/orders", 1_000, 503),
    ])

    const { endpoints } = await get("/api-endpoints")
    expect(endpoints[0]).toMatchObject({
      endpoint: "/api/orders",
      requests: 4,
      errors: 1,
      errorRate: 0.25,
      avg: 400,
    })

    const detail = await get(
      `/api-endpoints/detail?method=GET&endpoint=${encodeURIComponent("/api/orders")}`
    )
    expect(detail.statuses).toEqual({ "2xx": 3, "3xx": 0, "4xx": 0, "5xx": 1, network: 0 })
    expect(detail.p50).toBe(250)
    expect(detail.recentFailures).toHaveLength(1)
  })

  it("reports Web Vitals by normalized route", async () => {
    await ingest([
      vital("LCP", 1_200, "good", "/orders/1"),
      vital("LCP", 1_400, "good", "/orders/2"),
      vital("LCP", 4_500, "poor", "/checkout"),
      vital("INP", 90, "good", "/orders/1"),
    ])

    const vitals = await get("/web-vitals")
    expect(vitals.routes.map((r: { route: string }) => r.route)).toEqual([
      "/checkout",
      "/orders/:id",
    ])
    expect(vitals.routes[1]).toMatchObject({ loads: 2, inp: 90 })
    expect((await get("/web-vitals?route=%2Fcheckout")).vitals[0]).toMatchObject({
      name: "LCP",
      samples: 1,
    })
  })

  it("lists sessions with counts, pagination and search", async () => {
    await ingest([
      errorEvent({ sessionId: "s1" }),
      {
        ...ctx({ sessionId: "s1" }),
        type: "navigation",
        payload: { to: "/orders", kind: "initial" },
      },
      {
        ...ctx({ sessionId: "s2" }),
        type: "navigation",
        payload: { to: "/checkout", kind: "initial" },
      },
    ])

    const list = await get("/sessions")
    expect(list.sessions).toHaveLength(2)
    expect(list.hasMore).toBe(false)
    const s1 = list.sessions.find((s: { sessionId: string }) => s.sessionId === "s1")
    expect(s1).toMatchObject({ sessionId: "s1", eventCount: 2, errorCount: 1, lastPath: "/orders" })

    const searched = await get("/sessions?q=s2")
    expect(searched.sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual(["s2"])
  })

  it("returns a session's chronological timeline with issue links", async () => {
    await ingest([
      errorEvent({ sessionId: "s1" }),
      {
        ...ctx({ sessionId: "s1" }),
        type: "navigation",
        payload: { to: "/orders", kind: "initial" },
      },
    ])

    const detail = await get("/sessions/s1")
    expect(detail.session).toMatchObject({ sessionId: "s1", eventCount: 2, errorCount: 1 })
    expect(detail.truncated).toBe(false)
    // Most recent first: the error (timestamp = now) before the navigation (now - 60s).
    expect(detail.events).toMatchObject([
      {
        type: "error",
        summary: "TypeError: Cannot read properties of undefined (reading 'id')",
        issueId: expect.any(String),
      },
      { type: "navigation", issueId: null },
    ])

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/sessions/does-not-exist`,
      headers: { cookie },
    })
    expect(missing.statusCode).toBe(404)
  })

  it("hides other users' projects behind 404", async () => {
    const other = await signUp(app)
    for (const path of [
      "/overview",
      "/issues",
      "/api-endpoints",
      "/web-vitals",
      "/sessions",
      "/stream",
    ]) {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${project.id}${path}`,
        headers: { cookie: other.cookie },
      })
      expect(response.statusCode, path).toBe(404)
    }
  })

  it("streams newly ingested events over SSE and cleans up on disconnect", async () => {
    await app.listen({ port: 0, host: "127.0.0.1" })
    const { port } = app.server.address() as AddressInfo

    const received = await new Promise<string>((resolve, reject) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: `/api/v1/projects/${project.id}/stream`,
          headers: { cookie },
        },
        (res) => {
          expect(res.headers["content-type"]).toContain("text/event-stream")
          let buffer = ""
          res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString()
            if (buffer.includes("event: pulse")) {
              req.destroy()
              resolve(buffer)
            }
          })
          void ingest([errorEvent()])
        }
      )
      req.on("error", (error) =>
        error.message.includes("socket hang up") ? undefined : reject(error)
      )
      req.end()
    })

    const data = JSON.parse(received.split("data: ")[1]!.split("\n")[0]!)
    expect(data).toMatchObject({
      type: "error",
      path: "/orders",
      summary: "TypeError: Cannot read properties of undefined (reading 'id')",
      issueId: expect.any(String),
    })
    await expect.poll(() => app.eventBus.listenerCount(project.id)).toBe(0)
  })
})
