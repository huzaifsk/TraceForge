import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest"

import type { App } from "../app"
import {
  batch,
  createProject,
  createTestApp,
  errorEvent,
  resetDatabase,
  signUp,
  type TestProject,
} from "../test/helpers"

describe.skipIf(!inject("dbAvailable"))("release routes", () => {
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

  const base = () => `/api/v1/projects/${project.id}/releases`

  it("creates, lists and deletes a release", async () => {
    const create = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { version: "v1.2.3", notes: "First cut" },
    })
    expect(create.statusCode).toBe(201)
    const release = create.json()
    expect(release).toMatchObject({ version: "v1.2.3", notes: "First cut" })

    const list = await app.inject({ method: "GET", url: base(), headers: { cookie } })
    expect(list.json()).toEqual({ releases: [release] })

    const remove = await app.inject({
      method: "DELETE",
      url: `${base()}/${release.id}`,
      headers: { cookie },
    })
    expect(remove.statusCode).toBe(204)
    expect((await app.inject({ method: "GET", url: base(), headers: { cookie } })).json()).toEqual({
      releases: [],
    })
  })

  it("rejects a duplicate version with 409", async () => {
    await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { version: "v1.0.0" },
    })
    const dupe = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { version: "v1.0.0" },
    })
    expect(dupe.statusCode).toBe(409)
  })

  it("hides other users' projects and releases behind 404", async () => {
    const other = await signUp(app)
    const create = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { version: "v1.0.0" },
    })
    const release = create.json()

    for (const request of [
      { method: "GET" as const, url: base() },
      { method: "GET" as const, url: `${base()}/${release.id}` },
      { method: "DELETE" as const, url: `${base()}/${release.id}` },
    ]) {
      const response = await app.inject({ ...request, headers: { cookie: other.cookie } })
      expect(response.statusCode, request.url).toBe(404)
    }
  })

  it("returns event, issue and affected-user counts for a release", async () => {
    const create = await app.inject({
      method: "POST",
      url: base(),
      headers: { cookie },
      payload: { version: "v2.0.0" },
    })
    const release = create.json()

    await app.inject({
      method: "POST",
      url: `/api/v1/events?key=${project.publicKey}`,
      headers: { "content-type": "application/json" },
      payload: batch(project.id, [
        errorEvent({ release: "v2.0.0", sessionId: "s1" }),
        errorEvent({ release: "v2.0.0", sessionId: "s2" }),
        errorEvent({ release: "v3.0.0" }), // a different release; must not be counted
      ]),
    })

    const detail = await app.inject({
      method: "GET",
      url: `${base()}/${release.id}`,
      headers: { cookie },
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toMatchObject({
      release: { version: "v2.0.0" },
      eventCount: 2,
      issueCount: 1,
      affectedUsers: 2,
    })
  })
})
