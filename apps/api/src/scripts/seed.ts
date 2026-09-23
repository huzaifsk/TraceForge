/**
 * Seed a demo account with a week of realistic traffic.
 *
 *   pnpm db:seed
 *
 * Signs up demo@traceforge.local (password: correct-horse-battery) if needed,
 * recreates the "Acme Storefront" project, and pushes synthetic sessions
 * through the real ingestion pipeline (validation, fingerprinting, issue
 * grouping, projections), so the dashboard shows exactly what production would.
 * Deterministic: the same seed produces the same data.
 */
import { randomUUID } from "node:crypto"

import type { MonitoringEvent } from "@traceforge/event-schema/types"
import { rateWebVital } from "@traceforge/shared"
import { and, eq } from "drizzle-orm"

import { createAuth } from "../auth/auth"
import { createDb } from "../db/client"
import { projects, user } from "../db/schema"
import { loadEnv } from "../env"
import { buildDsn } from "../lib/dsn"
import { generateProjectId, generatePublicKey } from "../lib/ids"
import { enrichEvents, persistEvents, validateEvents } from "../services/ingest"

try {
  process.loadEnvFile()
} catch {
  // No .env file — rely on the real environment.
}

const DEMO_EMAIL = "demo@traceforge.local"
const DEMO_PASSWORD = "correct-horse-battery"
const PROJECT_NAME = "Acme Storefront"
const DAYS = 6.5
const SESSIONS = 700

// --- deterministic randomness ------------------------------------------------

let state = 0x9e3779b9
function random(): number {
  state |= 0
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const chance = (p: number) => random() < p
const between = (min: number, max: number) => min + random() * (max - min)
function pick<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0)
  let r = random() * total
  for (const [item, weight] of items) if ((r -= weight) <= 0) return item
  return items[items.length - 1]![0]
}
/** Log-normal-ish latency: most requests near `median`, a long tail. */
const latency = (median: number, spread = 0.6) =>
  Math.max(8, median * Math.exp((random() * 2 - 1) * spread + (chance(0.06) ? 1.4 : 0)))

// --- the fake storefront ------------------------------------------------------

type Device = MonitoringEvent["device"]
const DEVICES: readonly (readonly [Device, number])[] = [
  [
    {
      browser: "Chrome",
      browserVersion: "153",
      os: "Windows",
      osVersion: "10+",
      deviceType: "desktop",
      viewport: { width: 1536, height: 864 },
      language: "en-US",
      connection: "4g",
    },
    30,
  ],
  [
    {
      browser: "Chrome",
      browserVersion: "153",
      os: "macOS",
      deviceType: "desktop",
      viewport: { width: 1440, height: 900 },
      language: "en-GB",
      connection: "4g",
    },
    18,
  ],
  [
    {
      browser: "Safari",
      browserVersion: "18",
      os: "iOS",
      osVersion: "18",
      deviceType: "mobile",
      viewport: { width: 390, height: 844 },
      language: "en-US",
      connection: "4g",
    },
    20,
  ],
  [
    {
      browser: "Chrome",
      browserVersion: "152",
      os: "Android",
      osVersion: "14",
      deviceType: "mobile",
      viewport: { width: 412, height: 915 },
      language: "en-IN",
      connection: "3g",
    },
    14,
  ],
  [
    {
      browser: "Safari",
      browserVersion: "18",
      os: "macOS",
      deviceType: "desktop",
      viewport: { width: 1512, height: 982 },
      language: "en-US",
      connection: "4g",
    },
    8,
  ],
  [
    {
      browser: "Firefox",
      browserVersion: "142",
      os: "Windows",
      osVersion: "10+",
      deviceType: "desktop",
      viewport: { width: 1920, height: 1080 },
      language: "de-DE",
      connection: "4g",
    },
    6,
  ],
  [
    {
      browser: "Edge",
      browserVersion: "140",
      os: "Windows",
      osVersion: "10+",
      deviceType: "desktop",
      viewport: { width: 1366, height: 768 },
      language: "en-US",
      connection: "4g",
    },
    4,
  ],
]

interface Route {
  path: () => string
  weight: number
  lcp: number
  cls: number
  apis: readonly string[]
}
const id = () => String(Math.floor(between(1000, 99999)))
const ROUTES: readonly Route[] = [
  {
    path: () => "/",
    weight: 20,
    lcp: 1_500,
    cls: 0.02,
    apis: ["GET /api/products", "GET /api/profile"],
  },
  {
    path: () => "/products",
    weight: 18,
    lcp: 2_100,
    cls: 0.04,
    apis: ["GET /api/products", "GET /api/search"],
  },
  {
    path: () => `/products/${id()}`,
    weight: 22,
    lcp: 3_200,
    cls: 0.11,
    apis: ["GET /api/products/:id", "GET /api/recommendations"],
  },
  { path: () => "/cart", weight: 10, lcp: 1_700, cls: 0.03, apis: ["GET /api/cart"] },
  {
    path: () => "/checkout",
    weight: 8,
    lcp: 2_400,
    cls: 0.09,
    apis: ["GET /api/cart", "POST /api/payment"],
  },
  { path: () => "/orders", weight: 8, lcp: 1_900, cls: 0.02, apis: ["GET /api/orders"] },
  {
    path: () => `/orders/${id()}`,
    weight: 7,
    lcp: 1_800,
    cls: 0.01,
    apis: ["GET /api/orders/:id"],
  },
  { path: () => "/account", weight: 7, lcp: 1_400, cls: 0.01, apis: ["GET /api/profile"] },
]

const API: Record<string, { median: number; failure: number; status: number }> = {
  "GET /api/products": { median: 180, failure: 0.002, status: 500 },
  "GET /api/products/:id": { median: 140, failure: 0.012, status: 404 },
  "GET /api/search": { median: 420, failure: 0.01, status: 504 },
  "GET /api/recommendations": { median: 650, failure: 0.004, status: 500 },
  "GET /api/cart": { median: 110, failure: 0.001, status: 500 },
  "POST /api/payment": { median: 820, failure: 0.045, status: 502 },
  "GET /api/orders": { median: 240, failure: 0.006, status: 500 },
  "GET /api/orders/:id": { median: 160, failure: 0.004, status: 500 },
  "GET /api/profile": { median: 90, failure: 0.001, status: 401 },
}

interface Bug {
  route: RegExp
  probability: number
  /** Multiplier over time (0 = start of the window, 1 = now), for regressions. */
  growth?: (progress: number) => number
  browsers?: RegExp
  type: "error" | "unhandled_rejection"
  name: string
  message: () => string
  stack: string
}
const BUGS: readonly Bug[] = [
  {
    route: /^\/orders/,
    probability: 0.22,
    browsers: /Safari/,
    type: "error",
    name: "TypeError",
    message: () => "Cannot read properties of undefined (reading 'items')",
    stack:
      "TypeError: Cannot read properties of undefined (reading 'items')\n" +
      "    at OrdersTable (https://shop.acme.test/_next/static/chunks/app/orders/page-3f9a1c2b7d.js:124:18)\n" +
      "    at renderWithHooks (https://shop.acme.test/_next/static/chunks/node_modules/react-dom-5c1a.js:1:40211)\n" +
      "    at updateFunctionComponent (https://shop.acme.test/_next/static/chunks/node_modules/react-dom-5c1a.js:1:44680)\n" +
      "    at OrdersPage (https://shop.acme.test/_next/static/chunks/app/orders/page-3f9a1c2b7d.js:42:7)",
  },
  {
    route: /^\/checkout/,
    probability: 0.05,
    type: "error",
    name: "ChunkLoadError",
    message: () => `Loading chunk ${Math.floor(between(100, 999))} failed.`,
    stack:
      "ChunkLoadError: Loading chunk 412 failed.\n" +
      "    at __webpack_require__.f.j (https://shop.acme.test/_next/static/chunks/webpack-8d1e.js:1:3121)\n" +
      "    at loadCheckoutForm (https://shop.acme.test/_next/static/chunks/app/checkout/page-a91c.js:18:22)",
  },
  {
    route: /^\/products\//,
    probability: 0.07,
    growth: (p) => (p < 0.55 ? 0.05 : 1.6), // regression shipped mid-week
    type: "error",
    name: "RangeError",
    message: () => "Invalid currency code: undefined",
    stack:
      "RangeError: Invalid currency code: undefined\n" +
      "    at new NumberFormat (<anonymous>)\n" +
      "    at formatPrice (https://shop.acme.test/_next/static/chunks/lib/price-77ab.js:12:10)\n" +
      "    at PriceTag (https://shop.acme.test/_next/static/chunks/app/products/[id]/page-19ce.js:88:14)",
  },
  {
    route: /^\/checkout/,
    probability: 0.08,
    type: "unhandled_rejection",
    name: "Error",
    message: () => "Payment provider timeout after 10000ms",
    stack:
      "Error: Payment provider timeout after 10000ms\n" +
      "    at PaymentClient.authorize (https://shop.acme.test/_next/static/chunks/lib/payments-4c2e.js:61:13)\n" +
      "    at async submitOrder (https://shop.acme.test/_next/static/chunks/app/checkout/page-a91c.js:140:5)",
  },
  {
    route: /^\/cart/,
    probability: 0.015,
    type: "error",
    name: "SyntaxError",
    message: () => "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
    stack:
      "SyntaxError: Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON\n" +
      "    at JSON.parse (<anonymous>)\n" +
      "    at readCart (https://shop.acme.test/_next/static/chunks/lib/cart-0b1f.js:9:21)",
  },
]

// --- generation ---------------------------------------------------------------

function generate(now: number): MonitoringEvent[] {
  const events: MonitoringEvent[] = []
  const start = now - DAYS * 24 * 3_600_000

  for (let s = 0; s < SESSIONS; s++) {
    // More traffic in the daytime (UTC) and towards the end of the week.
    let t = start + random() * (now - start - 3_600_000)
    const hour = new Date(t).getUTCHours()
    if (hour < 6 && chance(0.6)) t += 8 * 3_600_000
    const progress = (t - start) / (now - start)
    const device = pick(DEVICES)
    const sessionId = `seed_${s}`
    const environment = chance(0.9) ? "production" : "staging"
    const release = progress < 0.55 ? "v2.8.0" : "v2.8.1"
    let previous: string | undefined

    const pageViews = 1 + Math.floor(random() * 6)
    for (let v = 0; v < pageViews && t < now - 60_000; v++) {
      const route = pick(ROUTES.map((r) => [r, r.weight] as const))
      const path = route.path()
      const page = { url: `https://shop.acme.test${path}`, path }
      const base = { sessionId, environment, release, page, device } as const
      const at = (offset: number) => Math.min(now - 1_000, Math.round(t + offset))
      const event = (type: MonitoringEvent["type"], payload: unknown, offset: number) =>
        events.push({
          ...base,
          id: randomUUID(),
          timestamp: at(offset),
          type,
          payload,
        } as MonitoringEvent)

      event(
        "navigation",
        previous
          ? { from: previous, to: path, kind: "push", durationMs: Math.round(latency(120)) }
          : { to: path, kind: "initial" },
        0
      )
      previous = path

      const mobile = device.deviceType === "mobile" ? 1.45 : 1
      const vitals: Record<"LCP" | "FCP" | "TTFB" | "INP" | "CLS", number> = {
        LCP: latency(route.lcp * mobile, 0.45),
        FCP: latency(route.lcp * 0.55 * mobile, 0.4),
        TTFB: latency(380, 0.5),
        INP: latency(device.deviceType === "mobile" ? 190 : 95, 0.7),
        CLS: Math.max(0, route.cls * between(0.2, 1.9)),
      }
      for (const [name, value] of Object.entries(vitals) as [keyof typeof vitals, number][]) {
        if (name === "INP" && chance(0.35)) continue // no interaction on this page view
        event("web_vital", { name, value, rating: rateWebVital(name, value), delta: value }, 4_000)
      }

      for (const call of route.apis) {
        const [method, endpoint] = call.split(" ") as [string, string]
        const spec = API[call]!
        const failed = chance(
          spec.failure * (endpoint === "/api/payment" && progress > 0.8 ? 2.5 : 1)
        )
        const network = failed && chance(0.15)
        const status = network ? 0 : failed ? spec.status : 200
        const concrete = endpoint.replace(":id", id())
        const payload = {
          method,
          url: `https://shop.acme.test${concrete}`,
          endpoint,
          status,
          durationMs: Math.round(network ? latency(4_000, 0.3) : latency(spec.median)),
          transport: "fetch",
          ...(failed && { errorKind: network ? "network" : "http" }),
        }
        event(failed ? "api_error" : "api_request", payload, between(200, 2_500))
      }

      for (const bug of BUGS) {
        if (!bug.route.test(path)) continue
        if (bug.browsers && !bug.browsers.test(device.browser)) continue
        const p = bug.probability * (bug.growth ? bug.growth(progress) : 1)
        if (!chance(p)) continue
        event(
          bug.type,
          {
            name: bug.name,
            message: bug.message(),
            stack: bug.stack,
            mechanism: bug.type === "error" ? "onerror" : "onunhandledrejection",
            handled: false,
          },
          between(500, 5_000)
        )
      }

      t += between(15_000, 120_000)
    }
  }
  return events.sort((a, b) => a.timestamp - b.timestamp)
}

// --- main ---------------------------------------------------------------------

const env = loadEnv()
const { db, sql } = createDb(env.DATABASE_URL)
const auth = createAuth(db, env)

try {
  let [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1)
  if (!owner) {
    await auth.api.signUpEmail({
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo User" },
    })
    ;[owner] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, DEMO_EMAIL))
      .limit(1)
  }
  if (!owner) throw new Error("could not create the demo user")

  await db
    .delete(projects)
    .where(and(eq(projects.ownerId, owner.id), eq(projects.name, PROJECT_NAME)))
  const [project] = await db
    .insert(projects)
    .values({
      id: generateProjectId(),
      publicKey: generatePublicKey(),
      ownerId: owner.id,
      name: PROJECT_NAME,
      platform: "nextjs",
    })
    .returning()

  const now = Date.now()
  const events = generate(now)
  let accepted = 0
  for (let i = 0; i < events.length; i += 100) {
    const { valid, rejected } = validateEvents(events.slice(i, i + 100))
    if (rejected > 0) throw new Error(`seed produced ${rejected} invalid events`)
    await persistEvents(db, project!.id, enrichEvents(valid, now, now))
    accepted += valid.length
  }

  console.warn(
    [
      "",
      `Seeded ${accepted.toLocaleString()} events into "${PROJECT_NAME}" (${project!.id}).`,
      `  Sign in:  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
      `  DSN:      ${buildDsn(env.PUBLIC_API_URL, project!.publicKey, project!.id)}`,
      "",
    ].join("\n")
  )
} finally {
  await sql.end()
}
