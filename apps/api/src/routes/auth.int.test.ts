import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest"

import type { App } from "../app"
import { createTestApp, DASHBOARD_ORIGIN, resetDatabase, signUp } from "../test/helpers"

describe.skipIf(!inject("dbAvailable"))("auth", () => {
  let app: App

  beforeAll(async () => {
    app = await createTestApp()
  })
  beforeEach(() => resetDatabase(app))
  afterAll(() => app.close())

  const headers = { origin: DASHBOARD_ORIGIN, "content-type": "application/json" }

  it("signs up with an httpOnly, SameSite=Lax session cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers,
      payload: { email: "ada@example.com", password: "correct-horse-battery", name: "Ada" },
    })

    expect(response.statusCode).toBe(200)
    const cookie = response.cookies.find((c) => c.name === "pulseed.session_token")
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite?.toLowerCase()).toBe("lax")
    expect(response.body).not.toContain("correct-horse-battery")
  })

  it("rejects short passwords", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers,
      payload: { email: "ada@example.com", password: "short", name: "Ada" },
    })
    expect(response.statusCode).toBe(400)
  })

  it("signs in with the right password and refuses the wrong one", async () => {
    const { email } = await signUp(app)

    const wrong = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers,
      payload: { email, password: "not-the-password" },
    })
    expect(wrong.statusCode).toBe(401)

    const right = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers,
      payload: { email, password: "correct-horse-battery" },
    })
    expect(right.statusCode).toBe(200)
  })

  it("stores a password hash, never the password", async () => {
    await signUp(app, "hash@example.com")
    const rows = await app.sql`select password from account`
    expect(rows[0]?.password).toBeTruthy()
    expect(rows[0]?.password).not.toContain("correct-horse-battery")
  })

  it("returns the session and ends it on sign-out", async () => {
    const { cookie } = await signUp(app)

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie },
    })
    expect(session.json()?.user?.email).toMatch(/@example\.com$/)

    await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { ...headers, cookie },
      payload: {},
    })
    const projects = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { cookie },
    })
    expect(projects.statusCode).toBe(401)
  })
})
