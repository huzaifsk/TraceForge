# SDK — `@pulseed/sdk`

The SDK is the hardest part to get right and the part most visible to other
engineers. It runs inside **someone else's production app**, so it has to be
invisible: tiny, fast, private, and unable to break its host.

## Contents
1. Public API
2. Module layout
3. Lifecycle
4. Context
5. Integrations (errors, rejections, fetch, XHR, web vitals, navigation, performance)
6. Pipeline (ignore → sample → redact → truncate → beforeSend → dedupe)
7. Queue, transport, retry
8. Offline buffer (Phase 2)
9. Web Worker (Phase 2) + benchmark
10. React and Next.js entry points (Phase 2)
11. Size and performance budgets
12. Testing

---

## 1. Public API

Keep the surface **small and stable**. Every export is a semver promise.

```ts
import { init, captureException, setTag, flush, close, getClient } from "@pulseed/sdk"

const client = init({
  dsn: "https://pk_live_xxx@pulseed.example.com/project/pw_12345abc",
  environment: "production",          // "development" | "staging" | "production"
  release: process.env.NEXT_PUBLIC_COMMIT_SHA,
  sampleRate: 1,                      // session sampling, 0–1
  integrations: { xhr: false },       // all others default on
  privacy: { captureUserContext: false },
  ignoreErrors: [/ResizeObserver loop/],
  ignoreUrls: [/\/analytics\//],
  beforeSend: (event) => event,       // return null to drop
  debug: false,
})

captureException(error, { tags: { feature: "checkout" } })   // mechanism: "manual", handled: true
await flush()                                                 // resolves when the queue drains (or times out)
await close()                                                 // unpatch everything, flush, reset
```

Rules:
- `init` is idempotent. A second call returns the existing client and warns in `debug` mode.
- On the server (`typeof window === "undefined"`), every export is a safe no-op, so the SDK can be imported in SSR code.
- Invalid options produce **one** `console.warn` and an inactive client. The SDK never throws.
- All options are documented in TSDoc (`packages/sdk/src/options.ts`). That file is the reference.

## 2. Module layout

```text
packages/sdk/src/                 (✅ = built in M2)
  index.ts              public API: init, captureException, setTag, flush, close, getClient   ✅
  options.ts            PulseedOptions → ResolvedOptions (defaults, clamping)              ✅
  dsn.ts                DSN parsing                                                            ✅
  client.ts             wires integrations → pipeline → queue → transport; retry; lifecycle   ✅
  hub.ts                the small interface integrations see                                   ✅
  pipeline.ts           EventDraft type, redaction, limits (64 KB), dedupe                     ✅
  transport.ts          text/plain POST, gzip, keepalive, sendBeacon chunking, Retry-After     ✅
  util.ts               uuid, truncate, safely, describeValue, whenIdle, matches               ✅
  context/device.ts     browser/OS/device type from the UA (major versions only)               ✅
  context/page.ts       redacted url, path, referrer                                           ✅
  context/session.ts    sessionId (sessionStorage), anonymousId (localStorage, opt-in)         ✅
  integrations/errors.ts       window "error" + "unhandledrejection"                           ✅
  integrations/http.ts         fetch wrapper + opt-in XHR                                       ✅
  integrations/vitals.ts       web-vitals → web_vital events                                    ✅
  integrations/navigation.ts   History API + popstate                                           ✅
  integrations/performance.ts  Navigation Timing + long-task count                              ✅
  offline.ts            IndexedDB store (Phase 2; M2 holds offline batches in memory)
  worker/               Phase 2
  react/  next/         Phase 2 entries: @pulseed/sdk/react, @pulseed/sdk/next
```

One integration per file, each exporting a `setup(client): Teardown` function.
The `Teardown` restores **exactly** what was patched.

## 3. Lifecycle

```text
init()
 ├─ resolveOptions()          invalid → warn once, return inactive client
 ├─ sample session            Math.random() < sampleRate, decided once per session
 ├─ build static context      device + session (computed once, cached)
 ├─ setup integrations        each wrapped: an integration that throws is skipped, not fatal
 ├─ start queue timer         flushIntervalMs
 └─ listeners                 visibilitychange=hidden → flush(beacon) · pagehide → flush(beacon)
                              online → replay offline store
close()
 └─ teardown integrations (reverse order) → flush → clear timers → reset singleton
```

- Flush on `visibilitychange` → `hidden`, not `beforeunload`/`unload`. Those are unreliable on mobile and break the bfcache.
- Never add an `unload` listener; it disqualifies the page from the bfcache and hurts the host's performance.

## 4. Context

**Device.** Prefer `navigator.userAgentData` (brands, platform, mobile) when it exists.
Otherwise fall back to a small ordered regex table over `navigator.userAgent`
covering Edge, Opera, Samsung Internet, Chrome, Firefox, Safari, iOS webviews and bots.
Order matters: Edge and Opera contain "Chrome", and Chrome contains "Safari".
Do not ship a UA-parsing library; it costs several KB. The device type is
`mobile | tablet | desktop | bot | unknown`. iPadOS reports as macOS, so treat
`maxTouchPoints > 1` on "Macintosh" as tablet.

**Page.** `url` = `redactUrl(location.href)`, `path` = `location.pathname`,
`route` = the route template when a router integration provides one, `referrer` =
`redactUrl(document.referrer)` or omitted.

**Also captured:** viewport (`innerWidth` × `innerHeight`), `navigator.language`,
and `navigator.connection?.effectiveType`. Never use IP-based geolocation in the SDK.
The server may derive a coarse country from `cf-ipcountry` or a similar header.

**Session.** `sessionId` is a random id kept in `sessionStorage` under `pulseed:sid`,
so it survives reloads and is per-tab. `anonymousId` is a random id in `localStorage`
under `pulseed:aid`, **only** when `privacy.captureUserContext` is true. All storage
access goes through try/catch: Safari private mode and sandboxed iframes throw.

## 5. Integrations

### Errors (`error`)
- `window.addEventListener("error", handler, true)` in **capture** phase. Never assign
  `window.onerror`, which would clobber the host's handler.
- Resource load errors (`event.target !== window`, e.g. a failed `<img>` or `<script>`) are
  not JS errors. Ignore them in the MVP. A chunk load failure surfaces as `ChunkLoadError`
  through the rejection path anyway.
- Prefer `event.error` (a real `Error` with `.stack`). Fall back to `message`,
  `filename`, `lineno` and `colno` when there is none.
- `"Script error."` with no stack is a cross-origin script. Capture it with
  `name: "CrossOriginScriptError"`, and have the docs explain `crossorigin="anonymous"`.
- Payload: `name`, `message` (truncated), `stack` (truncated), `mechanism: "onerror"`, `handled: false`.
  The SDK does **not** parse frames. The server runs `parseStack`, which keeps main-thread CPU
  and bytes down. The Phase 2 worker may add `frames`.

### Unhandled rejections (`unhandled_rejection`)
- `reason` may be anything. If it is an `Error`, handle it as above. Otherwise use
  `name: "UnhandledRejection"` and `message` = a safe, bounded stringify of the value.
  Never call `toString` on arbitrary objects without try/catch; it can throw or be huge.
- `mechanism: "onunhandledrejection"`.

### Fetch (`api_request`, `api_error`)
- Wrap `window.fetch` once, keeping the original in a closure. The wrapper must:
  - call the original with identical arguments and return **its** promise's resolution unchanged
  - never read, clone or consume request or response bodies (streams!), headers or cookies
  - measure with `performance.now()`
  - classify the outcome: `ok` → `api_request`. `!ok` → `api_error` with `errorKind: "http"`.
    A thrown `TypeError` → `network`, status 0. An `AbortError` → `abort`. Re-throw the original error unchanged.
  - skip our own ingest URL and anything in `ignoreUrls` (the recursion guard)
  - skip framework plumbing: Next.js App Router RSC and prefetch fetches carry an `_rsc` query parameter (`isFrameworkRequest`)
  - build `url: redactUrl(...)`, `endpoint: normalizeEndpoint(...)`, `method` (uppercased, default GET)
- Response size comes from `PerformanceResourceTiming.transferSize` when available,
  never from reading the body.
- Keep `fetch.toString()` and `fetch.name` sensible. Some libraries sniff for native fetch.

### XHR (opt-in, `integrations.xhr`)
Patch `open` to record the method and URL, and `send` to start timing. Listen for
`loadend` to classify the outcome. The same rules as fetch apply: no bodies, no headers.

### Web Vitals (`web_vital`)
- Use `onLCP`, `onINP`, `onCLS`, `onFCP` and `onTTFB` from the bundled `web-vitals` library, with `reportAllChanges: false`.
- Send `value`, `delta`, `rating` (from the library, which matches `rateWebVital`),
  `navigationType`, and `attribution` (a CSS selector only, when cheaply available).
- CLS and INP finalize when the page is hidden, which is why the queue must flush on `hidden`.
- Vitals are attributed to the page that **hard-loaded** (captured when the integration starts), because they
  often report after an SPA navigation (on input or when hidden). This matches the Web Vitals standard.

### Navigation (`navigation`)
- Patch `history.pushState` and `history.replaceState` (calling the originals first) and listen to
  `popstate`. Emit `{ from, to, kind, durationMs? }` with paths only.
- `durationMs` = the time from the route change to the next frame after the DOM settles
  (`requestAnimationFrame` ×2). It is an approximation, and documented as one.
- The first page load emits `kind: "initial"`. Reloads are detected via `PerformanceNavigationTiming.type`.
- Next.js: `onRouterTransitionStart(url, navigationType)` in `instrumentation-client.ts`
  gives an accurate start time (see §10).

### Performance (`performance`)
Once per page load, after `load` plus an idle callback, read `PerformanceNavigationTiming`:
`ttfbMs = responseStart - startTime` (the timing entry's own `startTime`), `domContentLoadedMs`, `loadMs`,
`transferBytes`, and the resource count. Count long tasks via
`PerformanceObserver({ type: "longtask" })` where supported.

## 6. Pipeline

Order matters. Cheap filters come first.

1. **ignore**: `ignoreErrors` (substring or RegExp against `message`), `ignoreUrls` for API events
2. **sample**: the session-level decision was made at init. Errors are never sub-sampled in the MVP.
3. **redact**: URLs through `redactUrl`, then strip anything that looks like a token in messages
   (`Bearer\s+\S+`, JWT pattern `eyJ[\w-]+\.[\w-]+\.[\w-]+`) → `[redacted]`
4. **truncate**: enforce the `LIMITS` fields. If the serialized event is still over 64 KB,
   drop `stack`/`frames` and then `componentStack`. If it is still over, drop the event (and `debug` logs why).
5. **beforeSend**: a user hook, wrapped in try/catch. If it throws, keep the original event.
6. **dedupe**: the same fingerprint more than 10 times per minute is collapsed. This is protection against error loops.

## 7. Queue, transport, retry

- The queue is bounded (`SDK_DEFAULTS.maxQueueSize` = 500). On overflow, drop the **oldest**
  `api_request` events first, and errors last.
- Flush triggers: `batchSize` reached, `flushIntervalMs` elapsed, page hidden, or an explicit `flush()`.
- Serialize the batch as `IngestBatch` (`schemaVersion`, `projectId`, `sdk`, `sentAt`, `events`).
- **Normal flush:** `fetch(ingestUrl + "?key=…", { method: "POST", body, keepalive: true,
  headers: { "content-type": "text/plain;charset=UTF-8" }, credentials: "omit" })`.
  A `text/plain` body and no custom headers keep it a CORS simple request, so there is no preflight.
- **Unload flush:** `navigator.sendBeacon(url, blob)` with a fallback to `fetch` with `keepalive`.
  The keepalive in-flight quota is 64 KB, so split the batch to fit.
- **Compression:** when `CompressionStream` exists and the body is over 1 KB, gzip it and
  append `&enc=gzip`. The server gunzips. Don't compress on the unload path if doing so
  would delay the beacon.
- **Retry:** only on network errors, 429 and 5xx. Backoff is `retryBaseDelayMs * 2^attempt`
  (1 s, 2 s, 4 s, 8 s) with ±20% jitter. Honor `Retry-After` on 429. After `maxRetries`,
  the batch goes to the offline store (Phase 2) or is dropped. Never retry 400/401/403/413;
  log once in `debug` mode.
- While `navigator.onLine === false`, skip network attempts and go straight to the offline store.

## 8. Offline buffer (Phase 2)

- IndexedDB database `pulseed`, object store `events`, keyed by event id, with an
  index on `timestamp`. Minimal promise wrapper; no `idb` dependency.
- Cap at `SDK_DEFAULTS.maxOfflineEvents` (1,000) and evict the oldest first.
- On `online` (and at init), replay in batches through the normal transport. Delete
  only after a 2xx. Server idempotency (ADR 13) makes a replay that duplicates in-flight events harmless.
- Multiple tabs: use the Web Locks API (`navigator.locks.request("pulseed-replay")`)
  so only one tab replays. Fall back to best-effort when locks are unavailable.
- Every IDB call is wrapped: private mode, quota errors and a blocked `onversionchange` must degrade to memory-only.

## 9. Web Worker (Phase 2) + benchmark

- `worker: "auto" | true | false` (default `"auto"`). The worker is created from an
  inlined Blob URL. If the CSP blocks `worker-src blob:`, construction throws, so fall back
  to the main-thread pipeline scheduled with `requestIdleCallback`.
- Main thread: capture raw data, then `postMessage` a minimal structured-cloneable record.
- Worker: normalize → parse stack → fingerprint → truncate → batch → serialize → gzip → `fetch`.
- The worker cannot see `document`, so context is captured on the main thread first.
- **Benchmark page** (dashboard `/benchmark`, PRD §18): run the same synthetic load
  (for example 5,000 errors with 30-frame stacks) through both modes in an iframe.
  Report main-thread blocking time (via the Long Tasks API), p95 frame duration and
  throughput in a chart with a methodology note. The numbers must be real and
  reproducible. Never hard-code results.

## 10. React and Next.js entry points (Phase 2)

Add these as extra tsdown entries and `exports` subpaths. `react` becomes an
**optional peer dependency**, and the core entry must never import React.

```tsx
// @pulseed/sdk/react
<PulseedErrorBoundary fallback={<Crash />}>…</PulseedErrorBoundary>
// captures error + componentStack, mechanism "error-boundary", handled true

// React 19 root options
createRoot(el, { onUncaughtError: reactErrorHandler(), onCaughtError: reactErrorHandler() })
```

```ts
// Next.js: instrumentation-client.ts (runs before hydration)
import { init } from "@pulseed/sdk"
init({ dsn: process.env.NEXT_PUBLIC_PULSEED_DSN!, environment: "production" })
export { onRouterTransitionStart } from "@pulseed/sdk/next"
```

Read `apps/dashboard/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`
before implementing. `onRouterTransitionStart(url, navigationType)` fires at the start
of App Router navigations.

## 11. Size and performance budgets

| Entry | Budget (min+brotli) |
|---|---|
| our code (core + all integrations + pipeline + transport) | ≈ 6 KB |
| everything including `web-vitals` (the `size-limit` gate) | ≤ 10 KB |
| `/react` | ≤ 1 KB beyond core |

- Update `size-limit` entries in `packages/sdk/package.json` as entries land. CI fails on regressions.
- No classes with large prototypes where a closure will do. No polyfills. Target ES2020.
- Integrations are tree-shakeable. Future work: `init({ integrations: [...] })` with explicit imports.
- Measure CPU overhead in Playwright with a CPU-throttled trace: an idle page, an error storm and a fetch storm.

## 12. Testing

- **Unit (Vitest + happy-dom):** options, DSN, each integration's classification logic,
  pipeline order, truncation at exactly 64 KB, queue triggers (fake timers), and backoff math with jitter bounds.
- **Patch safety:** after `close()`, `window.fetch`, `history.pushState` and the listeners are
  the originals, and the host's own `error` listeners still fire.
- **Browser (Playwright, real Chromium, Firefox and WebKit):** a fixture page loads the IIFE build.
  Assert real events reach a stub ingest server: error, rejection, fetch 500, network failure,
  navigation, and vitals (with the page hidden to finalize CLS and INP). Test offline, then online replay.
- **Never** assert on exact vitals values; assert shape and rating consistency.
