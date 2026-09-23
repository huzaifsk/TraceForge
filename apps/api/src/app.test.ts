import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { type App, buildApp } from "./app"
import { loadEnv } from "./env"

describe("health routes", () => {
  let app: App

  beforeAll(async () => {
    app = await buildApp({ env: loadEnv(), logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it("GET /health returns ok without touching the database", async () => {
    const response = await app.inject({ method: "GET", url: "/health" })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: "ok" })
  })

  it("sets security headers", async () => {
    const response = await app.inject({ method: "GET", url: "/health" })

    expect(response.headers["x-content-type-options"]).toBe("nosniff")
  })

  it("returns 404 for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/nope" })

    expect(response.statusCode).toBe(404)
  })
})

describe("loadEnv", () => {
  const validEnv = {
    DATABASE_URL: "postgres://u:p@localhost:5432/db",
    BETTER_AUTH_SECRET: "x".repeat(32),
  }

  it("fails fast with a readable message", () => {
    expect(() => loadEnv({ ...validEnv, DATABASE_URL: "not-a-url" })).toThrow(/DATABASE_URL/)
  })

  it("parses comma-separated dashboard origins", () => {
    const env = loadEnv({
      ...validEnv,
      DASHBOARD_ORIGINS: "http://a.test, http://b.test",
    })
    expect(env.DASHBOARD_ORIGINS).toEqual(["http://a.test", "http://b.test"])
  })
})
