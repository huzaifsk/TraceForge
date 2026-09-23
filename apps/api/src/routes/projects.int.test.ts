import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest"

import type { App } from "../app"
import {
  batch,
  createProject,
  createTestApp,
  DASHBOARD_ORIGIN,
  errorEvent,
  resetDatabase,
  signUp,
} from "../test/helpers"

describe.skipIf(!inject("dbAvailable"))("projects", () => {
  let app: App

  beforeAll(async () => {
    app = await createTestApp()
  })
  beforeEach(() => resetDatabase(app))
  afterAll(() => app.close())

  it("requires a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/projects" })
    expect(response.statusCode).toBe(401)
  })

  it("creates a project with a well-formed id, key and DSN", async () => {
    const { cookie } = await signUp(app)
    const project = await createProject(app, cookie, { name: "Shop", platform: "nextjs" })

    expect(project.id).toMatch(/^pw_[a-z0-9]{12}$/)
    expect(project.publicKey).toMatch(/^pk_[A-Za-z0-9]{32}$/)
    expect(project.dsn).toBe(`http://${project.publicKey}@localhost:4000/project/${project.id}`)
  })

  it("lists only the caller's projects", async () => {
    const alice = await signUp(app)
    const bob = await signUp(app)
    await createProject(app, alice.cookie, { name: "Alice's" })

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { cookie: bob.cookie },
    })
    expect(response.json().projects).toEqual([])
  })

  it("hides other users' projects behind 404", async () => {
    const alice = await signUp(app)
    const bob = await signUp(app)
    const project = await createProject(app, alice.cookie)

    for (const [method, url] of [
      ["GET", `/api/v1/projects/${project.id}`],
      ["PATCH", `/api/v1/projects/${project.id}`],
      ["POST", `/api/v1/projects/${project.id}/rotate-key`],
      ["DELETE", `/api/v1/projects/${project.id}`],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: { cookie: bob.cookie, origin: DASHBOARD_ORIGIN },
        ...(method === "PATCH" && { payload: { name: "pwned" } }),
      })
      expect(response.statusCode, `${method} ${url}`).toBe(404)
    }
  })

  it("validates input", async () => {
    const { cookie } = await signUp(app)
    for (const payload of [
      { name: "" },
      { name: "x".repeat(65) },
      { name: "Shop", platform: "angular" },
      { name: "Shop", allowedOrigins: ["https://shop.example.com/path"] },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers: { cookie },
        payload,
      })
      expect(response.statusCode, JSON.stringify(payload)).toBe(400)
    }
  })

  it("rotating the key revokes the old one immediately", async () => {
    const { cookie } = await signUp(app)
    const project = await createProject(app, cookie)
    const send = (key: string) =>
      app.inject({
        method: "POST",
        url: `/api/v1/events?key=${key}`,
        headers: { "content-type": "application/json" },
        payload: batch(project.id, [errorEvent()]),
      })

    expect((await send(project.publicKey)).statusCode).toBe(202) // warms the key cache

    const rotated = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/rotate-key`,
      headers: { cookie },
    })
    const { publicKey } = rotated.json()

    expect(publicKey).not.toBe(project.publicKey)
    expect((await send(project.publicKey)).statusCode).toBe(401)
    expect((await send(publicKey)).statusCode).toBe(202)
  })

  it("reports when the newest event arrived (null before the first)", async () => {
    const { cookie } = await signUp(app)
    const project = await createProject(app, cookie)
    expect(project).toMatchObject({ lastEventAt: null })

    await app.inject({
      method: "POST",
      url: `/api/v1/events?key=${project.publicKey}`,
      headers: { "content-type": "text/plain" },
      payload: JSON.stringify(batch(project.id, [errorEvent()])),
    })
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}`,
      headers: { cookie },
    })
    expect(Date.parse(response.json().lastEventAt)).toBeGreaterThan(Date.now() - 60_000)
  })

  it("updates and deletes", async () => {
    const { cookie } = await signUp(app)
    const project = await createProject(app, cookie)

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/v1/projects/${project.id}`,
      headers: { cookie },
      payload: { name: "Renamed", allowedOrigins: ["https://shop.example.com"] },
    })
    expect(updated.json()).toMatchObject({
      name: "Renamed",
      allowedOrigins: ["https://shop.example.com"],
    })

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${project.id}`,
      headers: { cookie },
    })
    expect(deleted.statusCode).toBe(204)
  })
})
