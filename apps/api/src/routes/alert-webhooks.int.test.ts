import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from "vitest"

import type { App } from "../app"
import {
  createProject,
  createTestApp,
  resetDatabase,
  signUp,
  type TestProject,
} from "../test/helpers"

describe.skipIf(!inject("dbAvailable"))("alert webhook routes", () => {
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
  afterEach(() => vi.restoreAllMocks())

  const base = () => `/api/v1/projects/${project.id}/alert-webhooks`

  it("creates, lists, updates and deletes a webhook", async () => {
    const create = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { url: "https://hooks.slack.com/services/x", kind: "slack" },
    })
    expect(create.statusCode).toBe(201)
    const webhook = create.json()
    expect(webhook).toMatchObject({
      url: "https://hooks.slack.com/services/x",
      kind: "slack",
      notifyOnNewIssue: true,
      notifyOnRegression: true,
      enabled: true,
    })

    const list = await app.inject({ method: "GET", url: base(), headers: { cookie } })
    expect(list.json()).toEqual({ webhooks: [webhook] })

    const update = await app.inject({
      method: "PATCH",
      url: `${base()}/${webhook.id}`,
      headers: { cookie },
      payload: { enabled: false, notifyOnRegression: false },
    })
    expect(update.statusCode).toBe(200)
    expect(update.json()).toMatchObject({ enabled: false, notifyOnRegression: false })

    const remove = await app.inject({
      method: "DELETE",
      url: `${base()}/${webhook.id}`,
      headers: { cookie },
    })
    expect(remove.statusCode).toBe(204)
    expect((await app.inject({ method: "GET", url: base(), headers: { cookie } })).json()).toEqual({
      webhooks: [],
    })
  })

  it("rejects a non-https or loopback webhook URL", async () => {
    const http = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { url: "http://example.com/hook" },
    })
    expect(http.statusCode).toBe(400)

    const loopback = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { url: "https://localhost/hook" },
    })
    expect(loopback.statusCode).toBe(400)
  })

  it("hides other users' projects and webhooks behind 404", async () => {
    const other = await signUp(app)
    const create = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { url: "https://example.com/hook" },
    })
    const webhook = create.json()

    for (const request of [
      { method: "GET" as const, url: base() },
      { method: "PATCH" as const, url: `${base()}/${webhook.id}`, payload: { enabled: false } },
      { method: "DELETE" as const, url: `${base()}/${webhook.id}` },
      { method: "POST" as const, url: `${base()}/${webhook.id}/test` },
    ]) {
      const response = await app.inject({ ...request, headers: { cookie: other.cookie } })
      expect(response.statusCode, request.url).toBe(404)
    }
  })

  it("sends a real request on /test and reports success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null))
    const create = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { url: "https://example.com/hook" },
    })
    const webhook = create.json()

    const response = await app.inject({
      method: "POST",
      url: `${base()}/${webhook.id}/test`,
      headers: { cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.com/hook")
  })

  it("reports a 502 when the test delivery fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }))
    const create = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { url: "https://example.com/hook" },
    })
    const webhook = create.json()

    const response = await app.inject({
      method: "POST",
      url: `${base()}/${webhook.id}/test`,
      headers: { cookie },
    })

    expect(response.statusCode).toBe(502)
  })
})
