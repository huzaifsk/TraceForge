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

  it("rejects a dashboard origin missing its scheme", () => {
    // A bare host (e.g. "thetraceforge.vercel.app") never equals a browser's
    // `Origin: https://thetraceforge.vercel.app` header, which silently
    // rejects every sign-in with INVALID_ORIGIN instead of failing at boot.
    expect(() => loadEnv({ ...validEnv, DASHBOARD_ORIGINS: "thetraceforge.vercel.app" })).toThrow(
      /DASHBOARD_ORIGINS.*scheme required/
    )
  })

  it("rejects a dashboard origin with a trailing slash or path", () => {
    expect(() => loadEnv({ ...validEnv, DASHBOARD_ORIGINS: "https://a.test/" })).toThrow(
      /DASHBOARD_ORIGINS/
    )
    expect(() => loadEnv({ ...validEnv, DASHBOARD_ORIGINS: "https://a.test/app" })).toThrow(
      /DASHBOARD_ORIGINS/
    )
  })

  it("refuses to boot in production with the localhost PUBLIC_API_URL default", () => {
    // PUBLIC_API_URL is baked verbatim into every project's DSN
    // (projects.dsn, shown on the onboarding screen) — leaving it at its
    // dev default in production silently hands out unusable DSNs instead
    // of failing loudly.
    expect(() => loadEnv({ ...validEnv, NODE_ENV: "production" })).toThrow(/PUBLIC_API_URL/)
  })

  it("accepts production once PUBLIC_API_URL is set", () => {
    const env = loadEnv({
      ...validEnv,
      NODE_ENV: "production",
      PUBLIC_API_URL: "https://api.example.com",
    })
    expect(env.PUBLIC_API_URL).toBe("https://api.example.com")
  })

  it("keeps the localhost default in development and test", () => {
    expect(loadEnv(validEnv).PUBLIC_API_URL).toBe("http://localhost:4000")
    expect(loadEnv({ ...validEnv, NODE_ENV: "test" }).PUBLIC_API_URL).toBe("http://localhost:4000")
  })
})
