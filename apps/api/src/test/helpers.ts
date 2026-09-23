import { randomUUID } from "node:crypto"

import { SCHEMA_VERSION } from "@pulseed/event-schema/constants"
import type { MonitoringEvent } from "@pulseed/event-schema/types"
import { sql } from "drizzle-orm"

import { type App, buildApp } from "../app"
import { type Env, loadEnv } from "../env"

export const DASHBOARD_ORIGIN = "http://localhost:3000"

export async function createTestApp(overrides: Partial<Record<keyof Env, string>> = {}) {
  const app = await buildApp({ env: loadEnv({ ...process.env, ...overrides }), logger: false })
  await app.ready()
  return app
}

/** Empty every table between tests; order-independent thanks to CASCADE. */
export async function resetDatabase(app: App) {
  await app.db.execute(sql`
    truncate table issue_users, issues, web_vitals, api_requests, events, projects,
      session, account, verification, "user" restart identity cascade
  `)
}

let userCounter = 0

/** Sign up a fresh dashboard user and return their session cookie header. */
export async function signUp(app: App, email = `user${++userCounter}-${Date.now()}@example.com`) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: { origin: DASHBOARD_ORIGIN, "content-type": "application/json" },
    payload: { email, password: "correct-horse-battery", name: "Test User" },
  })
  if (response.statusCode !== 200) {
    throw new Error(`sign-up failed: ${response.statusCode} ${response.body}`)
  }
  const cookie = response.cookies.map((c) => `${c.name}=${c.value}`).join("; ")
  return { email, cookie }
}

export interface TestProject {
  id: string
  publicKey: string
  dsn: string
}

export async function createProject(
  app: App,
  cookie: string,
  body: Record<string, unknown> = { name: "Shop" }
): Promise<TestProject> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/projects",
    headers: { cookie, origin: DASHBOARD_ORIGIN },
    payload: body,
  })
  if (response.statusCode !== 201) {
    throw new Error(`create project failed: ${response.statusCode} ${response.body}`)
  }
  return response.json()
}

const baseContext = {
  environment: "production",
  sessionId: "sess_a",
  page: { url: "https://shop.example.com/orders", path: "/orders" },
  device: { browser: "Chrome", os: "macOS", deviceType: "desktop" },
} as const

export function errorEvent(overrides: Partial<MonitoringEvent> = {}): MonitoringEvent {
  return {
    ...baseContext,
    id: randomUUID(),
    timestamp: Date.now(),
    type: "error",
    payload: {
      name: "TypeError",
      message: "Cannot read properties of undefined (reading 'id')",
      stack:
        "TypeError: Cannot read properties of undefined (reading 'id')\n" +
        "    at OrdersTable (https://shop.example.com/static/app.3f2a1b9c.js?token=secret:124:18)",
      mechanism: "onerror",
      handled: false,
    },
    ...overrides,
  } as MonitoringEvent
}

export function apiErrorEvent(status = 500): MonitoringEvent {
  return {
    ...baseContext,
    id: randomUUID(),
    timestamp: Date.now(),
    type: "api_error",
    payload: {
      method: "GET",
      url: "https://shop.example.com/api/orders/42",
      endpoint: "/api/orders/:id",
      status,
      durationMs: 1_800,
      transport: "fetch",
      errorKind: status === 0 ? "network" : "http",
    },
  }
}

export function webVitalEvent(): MonitoringEvent {
  return {
    ...baseContext,
    id: randomUUID(),
    timestamp: Date.now(),
    type: "web_vital",
    payload: { name: "LCP", value: 1_820, rating: "good", delta: 1_820 },
  }
}

export function batch(projectId: string, events: unknown[], sentAt = Date.now()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    projectId,
    sdk: { name: "@pulseed/sdk", version: "0.1.0" },
    sentAt,
    events,
  }
}
