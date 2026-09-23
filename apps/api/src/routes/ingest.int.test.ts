import { gzipSync } from "node:zlib"

import { LIMITS } from "@pulseed/event-schema/constants"
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
  webVitalEvent,
} from "../test/helpers"

describe.skipIf(!inject("dbAvailable"))("POST /api/v1/events", () => {
  let app: App
  let project: TestProject
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    ;({ cookie } = await signUp(app))
    project = await createProject(app, cookie)
  })
  afterAll(() => app.close())

  const send = (
    body: unknown,
    {
      key = project.publicKey,
      contentType = "text/plain;charset=UTF-8",
      origin,
      query = "",
    }: { key?: string | null; contentType?: string; origin?: string; query?: string } = {}
  ) =>
    app.inject({
      method: "POST",
      url: `/api/v1/events?${key ? `key=${key}` : ""}${query}`,
      headers: { "content-type": contentType, ...(origin && { origin }) },
      payload: typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    })

  const count = async (table: string) => {
    const [row] = await app.sql.unsafe(`select count(*)::int as n from ${table}`)
    return row?.n as number
  }

  it("accepts a batch as text/plain (CORS simple request) and stores it", async () => {
    const response = await send(batch(project.id, [errorEvent(), apiErrorEvent(), webVitalEvent()]))

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({ accepted: 3, rejected: 0 })
    expect(await count("events")).toBe(3)
    expect(await count("api_requests")).toBe(1)
    expect(await count("web_vitals")).toBe(1)
    expect(await count("issues")).toBe(2) // the JS error and the API error
  })

  it("accepts application/json and the key in a header", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events",
      headers: { "content-type": "application/json", "x-pulseed-key": project.publicKey },
      payload: batch(project.id, [errorEvent()]),
    })
    expect(response.statusCode).toBe(202)
  })

  it("is idempotent: re-sending the same batch creates no duplicates", async () => {
    const payload = batch(project.id, [errorEvent(), errorEvent(), apiErrorEvent()])

    await send(payload)
    const retry = await send(payload)

    expect(retry.statusCode).toBe(202)
    expect(await count("events")).toBe(3)
    expect(await count("api_requests")).toBe(1)
    const [issue] = await app.sql`select occurrence_count from issues where type = 'error'`
    expect(Number(issue?.occurrence_count)).toBe(2)
  })

  it("groups identical errors into one issue and counts distinct users", async () => {
    const events = [
      errorEvent({ sessionId: "s1" }),
      errorEvent({ sessionId: "s1" }),
      errorEvent({ sessionId: "s2" }),
    ]
    await send(batch(project.id, events))
    await send(
      batch(project.id, [errorEvent({ sessionId: "s2" }), errorEvent({ sessionId: "s3" })])
    )

    const issues =
      await app.sql`select occurrence_count, affected_users, title, culprit from issues`
    expect(issues).toHaveLength(1)
    expect(Number(issues[0]?.occurrence_count)).toBe(5)
    expect(issues[0]?.affected_users).toBe(3)
    expect(issues[0]?.culprit).toBe("OrdersTable (/static/app.js)")
  })

  it("reopens a resolved issue when it happens again", async () => {
    await send(batch(project.id, [errorEvent()]))
    await app.sql`update issues set status = 'resolved'`

    await send(batch(project.id, [errorEvent()]))

    const [issue] = await app.sql`select status from issues`
    expect(issue?.status).toBe("unresolved")
  })

  it("counts invalid events as rejected without failing the batch", async () => {
    const response = await send(
      batch(project.id, [errorEvent(), { type: "error", id: "nope" }, { junk: true }])
    )
    expect(response.json()).toEqual({ accepted: 1, rejected: 2 })
    expect(await count("events")).toBe(1)
  })

  it("rejects single events over 64 KB", async () => {
    const huge = errorEvent({ tags: { blob: "x".repeat(LIMITS.maxEventBytes) } })
    const response = await send(batch(project.id, [huge, errorEvent()]))
    expect(response.json()).toEqual({ accepted: 1, rejected: 1 })
  })

  it("strips query strings from stack traces before storing", async () => {
    await send(batch(project.id, [errorEvent()]))
    const [row] = await app.sql`select payload from events`
    expect(JSON.stringify(row?.payload)).not.toContain("token=secret")
  })

  it("corrects timestamps from a wrong browser clock", async () => {
    const anHourSlow = Date.now() - 3_600_000
    await send(batch(project.id, [errorEvent({ timestamp: anHourSlow })], anHourSlow))

    const [row] = await app.sql`select timestamp from events`
    // Drizzle's driver setup returns timestamptz as an ISO string.
    expect(Math.abs(new Date(String(row?.timestamp)).getTime() - Date.now())).toBeLessThan(10_000)
  })

  it("accepts gzip-compressed bodies", async () => {
    const body = gzipSync(JSON.stringify(batch(project.id, [errorEvent()])))
    const response = await send(body, { query: "&enc=gzip", contentType: "text/plain" })
    expect(response.statusCode).toBe(202)
  })

  it("rejects decompression bombs with 413", async () => {
    const bomb = gzipSync(Buffer.alloc(LIMITS.maxBatchBytes + 1, " "))
    const response = await send(bomb, { query: "&enc=gzip" })
    expect(response.statusCode).toBe(413)
  })

  it("rejects bodies over the batch limit with 413", async () => {
    const response = await send("x".repeat(LIMITS.maxBatchBytes + 1))
    expect(response.statusCode).toBe(413)
  })

  it.each([
    ["not JSON", "{nope"],
    ["an invalid envelope", JSON.stringify({ projectId: "pw_x", events: [] })],
    ["an empty body", ""],
  ])("returns 400 for %s", async (_label, body) => {
    const response = await send(body)
    expect(response.statusCode).toBe(400)
  })

  it("returns 415 for unexpected content types", async () => {
    const response = await send(batch(project.id, [errorEvent()]), {
      contentType: "application/x-www-form-urlencoded",
    })
    expect(response.statusCode).toBe(415)
  })

  it("returns 401 without a key, with an unknown key, or with another project's key", async () => {
    const other = await createProject(app, cookie, { name: "Other" })
    const payload = batch(project.id, [errorEvent()])

    expect((await send(payload, { key: null })).statusCode).toBe(401)
    expect((await send(payload, { key: "pk_doesnotexist" })).statusCode).toBe(401)
    expect((await send(payload, { key: other.publicKey })).statusCode).toBe(401)
    expect(await count("events")).toBe(0)
  })

  it("returns 403 for paused projects", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/v1/projects/${project.id}`,
      headers: { cookie },
      payload: { status: "paused" },
    })
    const response = await send(batch(project.id, [errorEvent()]))
    expect(response.statusCode).toBe(403)
  })

  it("enforces allowed origins when configured", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/v1/projects/${project.id}`,
      headers: { cookie },
      payload: { allowedOrigins: ["https://shop.example.com"] },
    })
    const payload = batch(project.id, [errorEvent()])

    expect((await send(payload, { origin: "https://evil.example.com" })).statusCode).toBe(403)
    expect((await send(payload)).statusCode).toBe(403) // no Origin header
    expect((await send(payload, { origin: "https://shop.example.com" })).statusCode).toBe(202)
  })

  it("allows any origin to call it without credentials (CORS)", async () => {
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/events",
      headers: {
        origin: "https://any-customer.example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-pulseed-key",
      },
    })
    expect(preflight.headers["access-control-allow-origin"]).toBe(
      "https://any-customer.example.com"
    )
    expect(preflight.headers["access-control-allow-credentials"]).toBeUndefined()
  })

  it("publishes newly stored events to live subscribers", async () => {
    const received: number[] = []
    const unsubscribe = app.eventBus.subscribe(project.id, (events) => {
      received.push(events.length)
    })
    const payload = batch(project.id, [errorEvent(), webVitalEvent()])

    await send(payload)
    await send(payload) // duplicates are not re-published
    unsubscribe()

    expect(received).toEqual([2])
    expect(app.eventBus.listenerCount(project.id)).toBe(0)
  })
})

describe.skipIf(!inject("dbAvailable"))("ingest rate limiting", () => {
  let app: App

  beforeAll(async () => {
    app = await createTestApp({ INGEST_RATE_LIMIT_PER_MINUTE: "3" })
    await resetDatabase(app)
  })
  afterAll(() => app.close())

  it("returns 429 with Retry-After once a key exceeds its limit", async () => {
    const { cookie } = await signUp(app)
    const project = await createProject(app, cookie)
    const send = () =>
      app.inject({
        method: "POST",
        url: `/api/v1/events?key=${project.publicKey}`,
        headers: { "content-type": "text/plain" },
        payload: JSON.stringify(batch(project.id, [errorEvent()])),
      })

    const statuses = []
    for (let i = 0; i < 4; i++) statuses.push((await send()).statusCode)

    expect(statuses).toEqual([202, 202, 202, 429])
    expect((await send()).headers["retry-after"]).toBeDefined()
  })
})
