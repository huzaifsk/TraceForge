import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { gunzipSync } from "node:zlib"

import { expect, type Page, test } from "@playwright/test"
import type { IngestBatch, MonitoringEvent } from "@traceforge/event-schema/types"

/*
 * Runs the real CDN build of the SDK in Chromium. Both the "customer app"
 * (https://shop.test) and the ingestion API (https://api.test) are served by
 * Playwright's router, so the suite needs no ports and sees exactly what the
 * SDK puts on the wire.
 */

const require = createRequire(import.meta.url)
const SDK_BUNDLE = readFileSync(
  join(dirname(require.resolve("@traceforge/sdk/package.json")), "dist/traceforge.iife.js"),
  "utf8"
)
const DSN = "https://pk_e2e@api.test/project/tf_e2etest01"

const APP_HTML = `<!doctype html>
<html><head><title>shop</title>
<script src="/sdk.js"></script>
<script>
  window.pw = TraceForge.init({ dsn: "${DSN}", environment: "staging", release: "e2e", flushIntervalMs: 200 })
</script>
</head>
<body><h1>Shop</h1><p>Hello</p></body></html>`

interface Ingest {
  events: MonitoringEvent[]
  requests: { url: string; contentType: string | null }[]
}

async function openApp(page: Page, path = "/"): Promise<Ingest> {
  const ingest: Ingest = { events: [], requests: [] }

  await page.route("https://api.test/**", async (route) => {
    const request = route.request()
    const raw = request.postDataBuffer() ?? Buffer.alloc(0)
    const body = request.url().includes("enc=gzip") ? gunzipSync(raw) : raw
    const batch = JSON.parse(body.toString("utf8")) as IngestBatch
    ingest.events.push(...batch.events)
    ingest.requests.push({
      url: request.url(),
      contentType: request.headers()["content-type"] ?? null,
    })
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: '{"accepted":1,"rejected":0}',
    })
  })

  await page.route("https://shop.test/**", async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === "/sdk.js")
      return route.fulfill({ contentType: "text/javascript", body: SDK_BUNDLE })
    if (pathname === "/api/fail") return route.fulfill({ status: 500, body: "{}" })
    if (pathname === "/api/ok") return route.fulfill({ status: 200, body: "{}" })
    return route.fulfill({ contentType: "text/html", body: APP_HTML })
  })

  await page.goto(`https://shop.test${path}`)
  return ingest
}

const ofType = <T extends MonitoringEvent["type"]>(ingest: Ingest, type: T) =>
  ingest.events.filter((e): e is Extract<MonitoringEvent, { type: T }> => e.type === type)

/** Emulate the tab going to the background: finalizes vitals and triggers the beacon flush. */
const hidePage = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })

test("captures an uncaught error with a real stack and device context", async ({ page }) => {
  const ingest = await openApp(page, "/orders?coupon=SECRET")

  await page.evaluate(() => {
    setTimeout(() => {
      const order = undefined as unknown as { id: string }
      order.id.toString()
    })
  })

  await expect.poll(() => ofType(ingest, "error").length).toBe(1)
  const [error] = ofType(ingest, "error")
  expect(error).toMatchObject({
    environment: "staging",
    release: "e2e",
    page: { path: "/orders", url: "https://shop.test/orders?coupon=[redacted]" },
    device: { browser: "Chrome", deviceType: expect.any(String) },
    payload: { name: "TypeError", mechanism: "onerror", handled: false },
  })
  expect(error?.payload.stack).toContain("TypeError")
})

test("captures unhandled promise rejections", async ({ page }) => {
  const ingest = await openApp(page)
  await page.evaluate(() => void Promise.reject(new Error("Payment provider timeout")))
  await expect.poll(() => ofType(ingest, "unhandled_rejection").length).toBe(1)
  expect(ofType(ingest, "unhandled_rejection")[0]?.payload.message).toBe("Payment provider timeout")
})

test("records failing and successful fetches, but never its own deliveries", async ({ page }) => {
  const ingest = await openApp(page)
  const statuses = await page.evaluate(async () => [
    (await fetch("/api/fail?id=42")).status,
    (await fetch("/api/ok")).status,
  ])
  expect(statuses).toEqual([500, 200]) // the app sees real responses

  await expect.poll(() => ofType(ingest, "api_error").length).toBe(1)
  await expect.poll(() => ofType(ingest, "api_request").length).toBe(1)
  expect(ofType(ingest, "api_error")[0]?.payload).toMatchObject({
    method: "GET",
    endpoint: "/api/fail",
    status: 500,
    errorKind: "http",
  })
  const allUrls = ingest.events.flatMap((e) => ("url" in e.payload ? [e.payload.url] : []))
  expect(allUrls.some((url) => url.includes("api.test"))).toBe(false)
})

test("records SPA navigations", async ({ page }) => {
  const ingest = await openApp(page)
  await page.evaluate(() => history.pushState({}, "", "/orders/123"))
  await expect
    .poll(() => ofType(ingest, "navigation").map((e) => e.payload.to))
    .toEqual(["/", "/orders/123"])
})

test("reports Web Vitals and the page-load summary when the page is hidden", async ({ page }) => {
  const ingest = await openApp(page)
  await page.waitForLoadState("load")
  await page.click("h1") // an interaction, so INP can be measured
  await page.waitForTimeout(300)
  await hidePage(page)

  await expect
    .poll(() => new Set(ofType(ingest, "web_vital").map((e) => e.payload.name)))
    .toEqual(new Set(["FCP", "LCP", "TTFB", "CLS", "INP"]))
  for (const vital of ofType(ingest, "web_vital")) {
    expect(["good", "needs-improvement", "poor"]).toContain(vital.payload.rating)
    expect(vital.payload.value).toBeGreaterThanOrEqual(0)
  }
  await expect.poll(() => ofType(ingest, "performance").length).toBe(1)
})

test("attributes Web Vitals to the page that loaded, not the route at report time", async ({
  page,
}) => {
  const ingest = await openApp(page, "/products/42")
  await page.waitForLoadState("load")
  await page.evaluate(() => history.pushState({}, "", "/checkout"))
  await hidePage(page)

  await expect.poll(() => ofType(ingest, "web_vital").length).toBeGreaterThan(0)
  for (const vital of ofType(ingest, "web_vital")) expect(vital.page.path).toBe("/products/42")
})

test("delivers as CORS simple requests (text/plain, key in the query string)", async ({ page }) => {
  const ingest = await openApp(page)
  await page.evaluate(() =>
    (window as unknown as { pw: { captureException(e: unknown): void } }).pw.captureException(
      new Error("x")
    )
  )
  await expect.poll(() => ingest.requests.length).toBeGreaterThan(0)
  for (const request of ingest.requests) {
    expect(request.url).toContain("key=pk_e2e")
    expect(request.contentType).toMatch(/^text\/plain/)
  }
})

test("does not break the page when the ingest API is down", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await openApp(page)
  await page.unroute("https://api.test/**")
  await page.route("https://api.test/**", (route) => route.abort("connectionrefused"))

  const works = await page.evaluate(async () => {
    ;(window as unknown as { pw: { captureException(e: unknown): void } }).pw.captureException(
      new Error("x")
    )
    await new Promise((resolve) => setTimeout(resolve, 500))
    return document.querySelector("h1")?.textContent
  })
  expect(works).toBe("Shop")
  expect(pageErrors).toEqual([])
})
