---
name: traceforge
description: The engineering handbook for TraceForge, an open-source frontend observability platform (browser SDK + Fastify ingestion API + Next.js dashboard + demo app) in a pnpm/Turborepo monorepo. Use it for ANY work in this repository — planning, writing or reviewing code in apps/api, apps/dashboard, apps/demo, packages/sdk, packages/event-schema, packages/shared or packages/ui; adding features from the PRD; designing dashboard screens; changing the event wire format or database; writing tests, CI or docs; or deciding "where does this go / how should this work". Read it before touching code, even for small changes.
---

# TraceForge — Engineering Handbook

TraceForge lets frontend developers see **what failed, where, how often, and who it
affected** in production: JavaScript errors, unhandled rejections, failing and slow
API calls, Core Web Vitals and navigation performance. It ships as:

- **`@traceforge/sdk`**: a tiny, privacy-first browser SDK, published to npm
- **`apps/api`**: a Fastify service that ingests events and serves the dashboard's data
- **`apps/dashboard`**: a Next.js dashboard, the product's face
- **`apps/demo`**: an intentionally broken app that proves the whole loop live

This is an open-source flagship project whose author's career is attached to it.
**The bar is "a senior engineer at Vercel/Linear/Sentry would sign off on it."**
Every change should be correct, tested, typed, accessible, fast, and pixel-perfect.
Working-but-sloppy is a failure. When unsure, choose the more robust option and say why.

## Read-first map

| You are about to… | Read |
|---|---|
| Decide product scope, or check what a feature must do | [`docs/PRD.md`](../../../docs/PRD.md) (source of truth for **what**) |
| Work on the SDK | [references/sdk.md](references/sdk.md) |
| Work on ingestion, auth, the database or query endpoints | [references/api.md](references/api.md) |
| Build or change any dashboard or demo UI | [references/dashboard.md](references/dashboard.md) + the UI skills below |
| Build the demo app | [references/demo.md](references/demo.md) |
| Write tests, CI, docs or a release, or finish any task | [references/quality.md](references/quality.md) |
| Pick up the next piece of work | [Roadmap](#roadmap) below |

The PRD says **what**; this skill says **how**. If they conflict, stop and raise it.
Never silently "fix" the PRD.

## Skills to combine with this one

| Work | Skill | Notes |
|---|---|---|
| Any shadcn component: add, compose, style, forms | `shadcn` | This repo is **Base UI** (`base-nova` style): use `render`, never `asChild`. Run the CLI from `apps/dashboard` so components land in `packages/ui`. |
| UI polish, interaction details, component craft | `emil-design-eng` | Its animation decision framework is mandatory before adding motion |
| Building a specific animation | `animate` | |
| Reviewing motion before merge | `review-animations` | User-invoked; suggest it on UI PRs |
| "What should animate here?" | `find-animation-opportunities` | |
| Motion audit across the app | `improve-animations` | |
| Toasts | `ask-sonner` | Only if the project uses Sonner; Base UI shadcn ships its own `toast`. Check `npx shadcn@latest info` first. |
| Any chart, stat tile, KPI row or dashboard layout | `dataviz` (bundled) | Palette already encoded in `packages/ui` tokens; follow its mark and interaction specs |
| Mobile polish (tap highlight, 100vh, input zoom) | `mobile-native` | |
| Radix → Base UI conversions from docs or examples | `migrate-radix-to-base` | Many online snippets are Radix; convert before pasting |

`write-swift`, `animate-expo` and `apple-design` were installed with the
Emil Kowalski pack. They are **not** relevant here: there is no native app.

## Repository map

```text
apps/
  api/          Fastify 5 — ingestion (POST /api/v1/events), auth, query API, SSE. Owns the DB.
  dashboard/    Next.js 16 App Router — the product UI. Never touches the DB directly.
  demo/         Next.js 16 — failure triggers wired to the real SDK.
packages/
  event-schema/ Wire contract: Zod schemas (.), plain TS types (./types), zero-dep constants (./constants)
  shared/       Isomorphic, zero-dep logic: fingerprinting, stack parsing, URL redaction, vitals ratings
  sdk/          @traceforge/sdk — published. Zero runtime dependencies (enforced by tsdown).
  ui/           shadcn/ui (Base UI, nova) components + design tokens (globals.css). Shared by both Next apps.
  eslint-config/ typescript-config/   Shared tooling.
docs/PRD.md     Product requirements.
docker-compose.yml   Local Postgres 17 (+ traceforge_test DB).
```

### Dependency rules (enforced by review, some by tooling)

```text
sdk        → event-schema/constants, event-schema/types, shared      (never "event-schema" root: that pulls in Zod)
shared     → event-schema/constants, event-schema/types              (never Zod, never DOM-only APIs without guards)
api        → event-schema (Zod OK), shared
dashboard  → ui, event-schema (types + constants), shared            (never drizzle/postgres; data comes from the API)
demo       → sdk, ui
ui         → nothing internal
```

- The SDK build uses `deps.onlyImport: []`, so it **fails** if the output imports
  any package. Bundle what you need, and justify every byte.
- `packages/event-schema/src/schema.types.ts` asserts that every Zod schema
  infers exactly the hand-written type in `types.ts`. Change both together.
- Postgres enums in `apps/api/src/db/schema.ts` are built from the
  event-schema constants. Changing a constant means writing a migration.

## Architecture decisions (ADR summary)

These are settled. Changing one needs an explicit reason written into this file.

| # | Decision | Why |
|---|---|---|
| 1 | **pnpm 12 + Turborepo**, `catalog:` versions in `pnpm-workspace.yaml` | One version per dep across the repo; cached pipelines |
| 2 | **TypeScript ~6.0** (not 7) | typescript-eslint supports <6.1. TS 7 is the Go port with no JS API yet. |
| 3 | **ESLint 9** flat config (not 10) | eslint-plugin-react does not support 10 yet |
| 4 | **tsdown** for packages and the API bundle | Rolldown-based successor to tsup; dts bundling; `onlyImport` guard |
| 5 | Internal packages are **built to `dist/`** (ESM, `types` + `default` conditions) | Works for Next, Node, Vitest and drizzle-kit's CJS loader (`require(esm)`) |
| 6 | **Fastify 5 + fastify-type-provider-zod** | Fast and typed; the same Zod contract validates the wire |
| 7 | **PostgreSQL + Drizzle ORM**, `postgres.js` driver, `prepare: false` | Free on Neon/Supabase. Poolers need unprepared statements. |
| 8 | **The API owns the database.** The dashboard calls the API. | One writer and one security boundary; the dashboard stays a pure UI |
| 9 | The dashboard reaches the API **same-origin** via a Next `rewrites()` proxy `/api/*` → `API_URL` | First-party session cookies; no cross-site cookie pain; SSE streams through |
| 10 | **Better Auth** (email + password) mounted in Fastify under `/api/auth/*` | Free, self-hosted, Drizzle adapter. Passwords hashed by the library; never logged. |
| 11 | **DSN** = `https://<publicKey>@<host>/project/<projectId>` | Public key is write-only and rotatable. Dashboard credentials never reach the SDK. |
| 12 | Ingestion accepts the key as header **or** `?key=`, and the body as `application/json` **or** `text/plain` | Unload flushes (`sendBeacon`, `keepalive`) must be CORS simple requests |
| 13 | **Client-generated UUID** per event; PK `(project_id, id)`; `ON CONFLICT DO NOTHING` | Retries and offline replays are idempotent |
| 14 | **The server computes the authoritative fingerprint** (`@traceforge/shared`) | Never trust the client for grouping; the SDK may compute the same value for dedupe |
| 15 | Browser timestamps are **skew-corrected** with `sentAt` vs server receive time | Wrong client clocks must not corrupt timelines |
| 16 | Real-time uses **SSE** from the API, fed by an in-process pub/sub | PRD §24. Postgres LISTEN/NOTIFY is the path to multiple instances. |
| 17 | shadcn **Base UI / nova**, neutral palette, **Geist Sans/Mono** | Calm, dense, developer-tool aesthetic |
| 18 | Charts: **Recharts through the shadcn `chart` component**, colors from `--chart-*` tokens, state colors from `--status-*` | Validated CVD-safe palette in light and dark |
| 19 | Web Vitals come from Google's **`web-vitals`** library, bundled into the SDK | INP/CLS edge cases are subtle; don't reimplement a standard |
| 20 | Next.js integration uses **`instrumentation-client.ts`** + `onRouterTransitionStart` | Runs before hydration; official App Router navigation hook |
| 21 | **One `react-is` and one `recharts` version** in the catalog | Two Recharts instances (from different peer resolutions) render empty charts |
| 22 | The SDK **ignores Next.js RSC and prefetch fetches** (`_rsc` query parameter) | Otherwise every `<Link>` prefetch looks like an API call |
| 23 | Web Vitals are **attributed to the hard-loaded page**, not the route at report time | Vitals often report after an SPA navigation |
| 26 | `pnpm check` runs with **`--concurrency=3`** | On an 8 GB laptop, ~10 parallel heavy tasks swap hard; stalls then race the API tests' DB resets. CI keeps full parallelism |
| 25 | In the Next apps, **`typecheck` runs after `build`** (`apps/*/turbo.json`) | `next build` rewrites `.next/types` while `next typegen && tsc` reads it; in parallel they race |
| 24 | `get-session` is **not rate-limited**; the dashboard forwards `x-forwarded-for` | Server-side session checks share one IP; limiting them would throttle every user |
| 27 | `DASHBOARD_ORIGINS` entries **require a scheme** (`https://host`, no path/trailing slash), validated at boot | A bare host never equals a browser's `Origin` header — the API must fail loudly, not silently reject every sign-in |
| 28 | Vercel's `ignoreCommand` for `dashboard`/`demo` is **`turbo query affected`** (not the deprecated `turbo-ignore`) | Skips rebuilding a Next app on commits that only touch `apps/api` |
| 29 | `PUBLIC_API_URL` **rejects any loopback host** (`localhost`/`127.0.0.1`/`::1`/`0.0.0.0`, any port) in `production`, validated at boot | It's baked verbatim into every project's DSN — a loopback value silently ships onboarding instructions that only work on the deploying machine |

## Event lifecycle (end to end)

```text
Browser app
  │  window "error" / "unhandledrejection" / fetch / XHR / web-vitals / History API
  ▼
SDK integration      builds a MonitoringEvent (id, timestamp, env, session, page, device, payload)
  ▼
Pipeline             ignore rules → sampling → redact → truncate to 64 KB → beforeSend → dedupe
  ▼
Queue (memory)       flush at 20 events OR 5 s OR page hidden, whichever comes first
  ▼
[Worker]             Phase 2: normalize + fingerprint + serialize + gzip off the main thread
  ▼
Transport            fetch(keepalive) / sendBeacon on unload → POST /api/v1/events?key=…
  │   failure → backoff 1s·2s·4s·8s (+ jitter) → IndexedDB (Phase 2) → replay on "online"
  ▼
API                  envelope schema → key + origin auth → rate limit → per-event schema
                     → skew-correct → fingerprint → one transaction:
                       events + api_requests + web_vitals + issues upsert → publish to SSE
                     → 202 { accepted, rejected }
  ▼
Dashboard            query endpoints (aggregations) + /api/v1/projects/:id/stream (SSE)
```

## Engineering rules

**TypeScript.** `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
No `any` (lint error). No `as` casts at trust boundaries: parse with Zod
instead. Use `import type` for types. Prefer discriminated unions over optional soup.
Name things after the domain: `issue`, `fingerprint`, `endpoint`, `vital`.

**Boundaries validate; the interior trusts.** Validate env (`apps/api/src/env.ts`),
HTTP input (Zod route schemas), SDK options (`resolveOptions`) and anything read
from storage or `postMessage`. Past a boundary, don't re-validate.

**The SDK never breaks the host app.** No throwing from public APIs. Every callback we
register is wrapped in try/catch. Never monkey-patch without preserving
the original's behavior, `this` and return value. Never capture the SDK's own
requests or errors (recursion guard). Never block the main thread: use
`requestIdleCallback`/microtask batching and keep hot paths allocation-light.

**Privacy by default** (PRD §13, §32). Never read input values, cookies,
`localStorage` contents (other than our own namespaced keys), request or response
bodies, or `Authorization` headers. Redact every URL's query values
(`redactUrl`). `captureUserContext` defaults to `false`. When in doubt, collect less.

**Security.** Treat every ingested field as hostile. It is rendered as **text**,
never HTML: no `dangerouslySetInnerHTML`, and stack traces are rendered as text.
Enforce payload caps (`LIMITS`), rate limits and origin allow-lists. Keep secrets
only in env. Logs redact `authorization`, `cookie` and the ingest key.

**Performance budgets.**
- SDK ≤ 10 KB min+brotli in total: about 6 KB of our code plus 2.9 KB for `web-vitals` (enforced by `size-limit`). Measured 9.2 KB at M2.
- SDK main-thread work < 1% CPU in normal use.
- Dashboard: LCP < 2.0 s, INP < 150 ms, CLS < 0.05 on the overview page (TraceForge monitors itself).
- Ingestion: p95 < 50 ms for a 20-event batch on the free tier.

**Errors and logging.** API errors return `{ error, message }` with a correct status
code and never leak stack traces or SQL. Use `request.log`, not `console`, in the API.

**Comments** explain *why*, not *what*. Every exported function in `shared`, `sdk`
and `event-schema` gets a one-line TSDoc comment. Don't narrate obvious code.

**Style.** Prettier: no semicolons, double quotes, 100 columns, Tailwind class sorting.
Formatting is never debated; run `pnpm format`.

**Next.js 16 is newer than most training data.** Before using a Next API, read the
matching page in `apps/dashboard/node_modules/next/dist/docs/` and heed deprecations.
Don't rely on memory of older versions (for example, `middleware` is now `proxy`,
and async `params` and `searchParams` are required).

**Versions.** Use `catalog:` for shared deps. pnpm 12 enforces a minimum release age:
if an install fails on a fresh version, wait or add a reviewed exclusion. Never
disable the policy.

## Commands

```bash
pnpm install                 # Node >= 22.12 (see .nvmrc)
pnpm db:up                   # Postgres 17 in Docker (also creates traceforge_test)
pnpm db:migrate              # apply apps/api/drizzle migrations
pnpm dev                     # api :4000 (PORT in apps/api/.env), dashboard :3000, demo :3001
pnpm check                   # format:check + lint + typecheck + test + build: run before every commit
pnpm db:seed                 # demo account + a week of realistic data
pnpm e2e                     # Playwright: SDK in Chromium (+ full stack with E2E_FULLSTACK=1)
pnpm db:generate --name <x>  # after editing apps/api/src/db/schema.ts
pnpm --filter @traceforge/sdk size   # bundle budget
```

Add a shadcn component (it lands in `packages/ui/src/components`):

```bash
cd apps/dashboard && pnpm dlx shadcn@latest add card
```

## Roadmap

Work top-down. Each milestone ends green on `pnpm check` and meets its
acceptance criteria. Tick the box in this file when a milestone lands.

### M0 — Foundation ✅
- [x] Monorepo, tooling, shared configs, design tokens, docker Postgres
- [x] `event-schema`: full wire contract + drift guard + tests
- [x] `shared`: fingerprint, stack parsing, URL redaction and endpoint normalization, vitals ratings + tests
- [x] `sdk`: DSN parsing, option resolution, safe `init()`, ESM/CJS/IIFE builds, zero-dep guard
- [x] `api`: env validation, app factory, health/ready, security headers, DB schema + initial migration
- [x] `dashboard` + `demo`: Next 16 shells on the shared UI package

### M1 — Projects, auth, ingestion (backend MVP) ✅
- [x] Better Auth (email + password, min 10 chars) in Fastify at `/api/auth/*`; tables in `apps/api/src/db/auth-schema.ts`; cookies `traceforge.*`, `httpOnly`, `sameSite=lax`, `secure` in production
- [x] Project CRUD + key rotation (`routes/projects.ts`), owner-scoped (other users' projects → 404), max 20 per user, `tf_`/`pk_` ids via unbiased crypto sampling (`lib/ids.ts`), DSN built server-side (`lib/dsn.ts`)
- [x] `POST /api/v1/events` (`routes/ingest.ts` + `services/ingest.ts`): 202/400/401/403/413/415/429, per-event rejection, in-batch id dedupe, skew correction, stack sanitizing, fingerprinting, one-transaction persist with issue upsert, exact affected users (`issue_users`), regression reopen, gzip with bomb cap, key cache with instant invalidation (`services/project-keys.ts`), in-process event bus for SSE (`services/event-bus.ts`)
- [x] 49 API tests, including integration suites against `traceforge_test` (`*.int.test.ts`; skipped locally without Docker, never in CI)
- [x] Accepted: live curl run — batch stored, replay deduplicated, bad key/JSON/size/session → 401/400/413/401

### M2 — SDK core (SDK MVP) ✅
- [x] Context: UA parsing without a library (major versions only), viewport, language, connection; `sessionId` / opt-in `anonymousId`
- [x] Integrations: errors (capture phase, resource errors ignored), rejections, fetch, opt-in XHR, web-vitals (bundled), History API navigation, Navigation Timing + long tasks
- [x] Pipeline (ignore → redact → 64 KB limit → beforeSend → dedupe 10/min), bounded queue (20 events / 5 s / page hidden), text/plain transport with gzip, keepalive and chunked sendBeacon, backoff with jitter and Retry-After, in-memory hold while offline
- [x] 58 unit tests (happy-dom) + 7 Chromium tests of the real CDN build (`e2e/sdk`, `pnpm e2e`); 9.2 KB of the 10 KB budget
- [ ] Demo triggers → DB is verified in M4 (the demo app does not exist yet)

### M3 — Dashboard MVP ✅
- [x] Query API (`routes/analytics.ts`, `services/analytics.ts`): overview, issues (search, status, browser, sort, offset paging), issue detail (frames, breakdowns via grouping sets), issue status, endpoints, endpoint detail, Web Vitals (p75, distribution, trend, routes, facets), SSE stream with replay; contract in `packages/event-schema/src/api.ts`
- [x] Dashboard screens: login and sign-up, projects and new project, onboarding (live "waiting for first event"), Overview, Issues, Issue detail, Web Vitals, API performance and endpoint detail, Live events, Settings (general, DSN and key rotation, allowed origins and pause, delete)
- [x] Shell: collapsible sidebar, project switcher, URL-synced environment and range filters (a second row on phones), ⌘K command menu, user menu with theme
- [x] Loading skeletons, empty states and error boundaries on every screen; axe WCAG 2.2 AA clean in light and dark; no console errors (`e2e/fullstack/dashboard-quality.spec.ts`)
- [x] `pnpm db:seed`: a deterministic week of realistic traffic through the real pipeline

### M4 — Demo app + first public release (development done; publishing deferred)
- [x] Demo (`apps/demo`): JS error, rejection, API 500, slow API, network failure, slow render (INP), large image (LCP), layout shift (CLS), SPA navigation; session log via `beforeSend`
- [x] Accepted: `e2e/fullstack/demo-to-dashboard.spec.ts` (click → dashboard) and `demo-vitals.spec.ts` (poor LCP and CLS on the right routes)
- [x] README with quick start, testing guide and privacy; CONTRIBUTING; SDK README
- [ ] Deferred by the maintainer: GitHub repo, Changesets, npm publish with provenance, deploy (free host + Neon)

### M5 — Phase 2 (PRD §37)
IndexedDB offline queue → Web Worker pipeline + the published benchmark page (worker vs main thread) → live SSE stream → advanced filtering and trends → React Error Boundary (`@traceforge/sdk/react`) → Next.js helper (`@traceforge/sdk/next`) → source maps (upload API + server-side symbolication)

### M6+ — Phases 3 and 4
Alert rules, webhooks and Slack, releases and regression detection, resolution workflow, then rule-based **Engineering Insights** (PRD §39). No paid AI APIs.

## Definition of done (every change)

1. `pnpm check` is green locally. No new lint warnings, no `// @ts-expect-error` without an explanatory comment.
2. Tests cover the behavior, including failure paths and edge cases, not just the happy path.
3. UI changes: verified in the browser in light and dark themes, at desktop and mobile widths, with keyboard only. Loading, empty and error states exist.
4. Public API or wire-format changes: types, schema, drift guard, migration and docs updated together.
5. No privacy regressions: nothing new is collected without a documented reason and an opt-in when personal.
6. The diff reads like the code around it. Remove dead code, debugging output and TODOs without an owner.

See [references/quality.md](references/quality.md) for the full review checklist.
