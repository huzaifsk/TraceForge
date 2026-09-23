# API — `apps/api`

A Fastify 5 service. It is the **only** component that talks to Postgres. It has three jobs:

1. **Ingest** (the write path): `POST /api/v1/events`. Hot, public, hostile input.
2. **Auth**: `/api/auth/*` (Better Auth, email + password) for dashboard users.
3. **Query** (the read path): `/api/v1/projects/...` aggregations + the SSE stream for the dashboard.

## Contents
1. Layout and conventions
2. Ingestion
3. Fingerprinting and issues
4. Authentication and authorization
5. Query endpoints
6. Real-time (SSE)
7. Database
8. Rate limiting, CORS, limits
9. Testing

---

## 1. Layout and conventions

```text
apps/api/src/
  server.ts          process entry: env → buildApp → listen → graceful shutdown   ✅
  app.ts             buildApp(): plugins, error handler, route registration       ✅
  env.ts             Zod-validated env                                            ✅
  db/schema.ts       Drizzle schema (source of truth for migrations)              ✅
  db/client.ts       postgres.js + drizzle                                         ✅
  auth/              Better Auth instance + Fastify handler + requireSession hook
  routes/
    health.ts        /health (liveness), /ready (DB readiness)                     ✅
    ingest.ts        POST /api/v1/events
    projects.ts      project CRUD + key rotation
    issues.ts, api-requests.ts, web-vitals.ts, overview.ts, stream.ts
  services/          pure-ish logic: ingest pipeline, issue upsert, aggregations
  lib/               small helpers (ids, time, errors)
```

- Routes are thin. They parse (Zod schema), authorize, call a service and shape the response.
- Every route declares `schema.response` so that nothing leaks through serialization.
- IDs: projects `pw_` + 12 base36 chars, public keys `pk_` + 32 base62 chars, both from `crypto.getRandomValues`.
- `buildApp({ env, logger })` must stay side-effect-free until `listen`, so tests use `app.inject`.
- New env vars go in `env.ts`, `.env.example` and `turbo.json` (`env`/`globalEnv`). The lint rule `turbo/no-undeclared-env-vars` enforces this.

## 2. Ingestion

`POST /api/v1/events?key=<publicKey>[&enc=gzip]`

Also accepted: the header `x-pulseed-key: <publicKey>`, and `content-type` of `application/json` or `text/plain`.

Register a raw-body content-type parser for `text/plain` and `application/octet-stream`
on this route. The route gunzips when `enc=gzip` (with a decompressed-size cap of
`LIMITS.maxBatchBytes`, to protect against zip bombs), then runs `JSON.parse` in try/catch.

Pipeline, in order:

| Step | Failure → |
|---|---|
| Body size ≤ `LIMITS.maxBatchBytes` (Fastify `bodyLimit`) | **413** |
| Parse JSON, validate the envelope with `ingestBatchSchema` | **400** `{ error, message, issues }` |
| Resolve the key → project (in-memory LRU cache, 60 s TTL) and check that `project.id === batch.projectId` | **401** |
| Project `status === "active"` | **403** |
| `Origin` in `allowedOrigins` (when that list is non-empty) | **403** |
| Rate limit per public key (`INGEST_RATE_LIMIT_PER_MINUTE`) | **429** with `Retry-After` |
| For each event: byte size ≤ 64 KB, then `monitoringEventSchema.safeParse` | invalid events are **counted in `rejected`**, not fatal |
| Skew correction: `offset = receivedAt - batch.sentAt`. If `|offset| > 5 min`, add it to every timestamp. Clamp to `[receivedAt - 7 days, receivedAt + 1 min]` | |
| Enrich: `fingerprint` for `error`/`unhandled_rejection` (from `frames` when present, otherwise `parseStack(stack)`); for `api_error` the fingerprint is `hash53("api" + method + endpoint + status)` | |
| **One transaction:** insert `events` (`ON CONFLICT (project_id, id) DO NOTHING RETURNING id`); insert projections for newly inserted rows only; upsert `issues` | **500** (logged, nothing partially written) |
| Publish the inserted events to the project's SSE channel | |
| **202** `{ accepted, rejected }` | |

Notes:
- Use `RETURNING` so projections and issue counters only count rows that were actually new. That is what makes retries idempotent end to end.
- Multi-row inserts (one statement per table), never a per-event loop of queries.
- The response to a `sendBeacon` is ignored, so the status codes are for `fetch` clients and tests.
- Don't echo event content back in errors. Report field paths only.

## 3. Fingerprinting and issues

- Algorithm: `computeFingerprint` in `packages/shared/src/fingerprint.ts`. It uses type, the
  normalized message, and the top 5 in-app frames (function + deploy-stable filename),
  with line and column numbers excluded. **Changing it regroups every issue**, so treat it as a migration:
  version it (`fp_version`) if it ever changes.
- Issue title: `${name}: ${message}` truncated to 200 characters. Culprit: the first in-app frame, `function (file)`.
- Upsert:

```sql
INSERT INTO issues (project_id, fingerprint, type, title, culprit, first_seen, last_seen, occurrence_count)
VALUES (...) -- aggregated per fingerprint within the batch
ON CONFLICT (project_id, fingerprint) DO UPDATE SET
  last_seen        = GREATEST(issues.last_seen, EXCLUDED.last_seen),
  first_seen       = LEAST(issues.first_seen, EXCLUDED.first_seen),
  occurrence_count = issues.occurrence_count + EXCLUDED.occurrence_count,
  status           = CASE WHEN issues.status = 'resolved' THEN 'unresolved' ELSE issues.status END  -- regression
```

- **Affected users** = distinct `coalesce(anonymous_id, session_id)`. Keep it exact with an
  `issue_users (issue_id, user_key)` table with a primary key on both columns.
  `INSERT ... ON CONFLICT DO NOTHING RETURNING` → increment `affected_users` by the number
  of returned rows. The UI labels it "Users" with a tooltip: "Unique installations
  when user context is enabled, otherwise unique sessions."

## 4. Authentication and authorization

- Better Auth with the Drizzle adapter (Postgres) and email + password. Mount its handler at
  `/api/auth/*` (convert Fastify's request into a Fetch `Request`, as its Fastify integration guide describes).
  Generate its tables with the Better Auth CLI into the Drizzle schema, then run `pnpm db:generate`.
- Cookies: `httpOnly`, `sameSite: "lax"`, `secure` in production. The dashboard reaches the API
  through a same-origin rewrite (ADR 9), so the cookies are first-party.
- A `requireSession` preHandler decorates `request.user`. Every `/api/v1/projects/:projectId/*`
  route checks `project.ownerId === request.user.id`, and returns **404, not 403**, for other users' projects so that ids can't be probed.
- The ingest key is **write-only**: it can never read data. Rotating it invalidates the LRU cache entry immediately.
- Add a `BETTER_AUTH_SECRET` (32+ bytes) and a `BETTER_AUTH_URL` env var. Neither is ever logged.

## 5. Query endpoints

Every endpoint takes `?environment=&from=&to=` (ISO timestamps, defaulting to the last 24 h,
max 90 days). Do the aggregation **in SQL** and return chart-ready series.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/projects` / `POST` / `PATCH :id` / `POST :id/rotate-key` | projects (the DSN is built server-side) |
| `GET /api/v1/projects/:id/overview` | error count, API failure count, users, p75 LCP/INP/CLS, error trend (bucketed), top 5 issues |
| `GET /api/v1/projects/:id/issues?q=&status=&browser=&sort=&cursor=` | paginated issues (keyset on `last_seen, id`) |
| `GET /api/v1/projects/:id/issues/:issueId` | issue + occurrence trend + browser/OS/route breakdown + the latest event (full stack) |
| `PATCH /api/v1/projects/:id/issues/:issueId` | status change (resolve/ignore) |
| `GET /api/v1/projects/:id/api-endpoints` | per endpoint: requests, errors, error rate, avg, p95 |
| `GET /api/v1/projects/:id/api-endpoints/:endpoint` | latency series (p50/p95), status breakdown |
| `GET /api/v1/projects/:id/web-vitals?route=&browser=&deviceType=` | p75 per vital + rating distribution + trend |
| `GET /api/v1/projects/:id/stream` | SSE (§6) |

- Percentiles: `percentile_cont(0.75) WITHIN GROUP (ORDER BY value)`. **p75 is the Web Vitals standard; don't show averages for vitals.**
- Time buckets: `date_bin('<interval>', timestamp, '<from>')`, with the interval chosen so there are about 30 to 60 points. Fill empty buckets with `generate_series` so charts have no gaps.
- Response bodies are typed with Zod schemas shared with the dashboard. Put them in
  `packages/event-schema/src/api.ts` when the dashboard needs them.

## 6. Real-time (SSE)

- `GET /api/v1/projects/:id/stream` (session-authenticated) sends `content-type: text/event-stream`
  with `cache-control: no-cache, no-transform` and `x-accel-buffering: no`.
- Frames: `event: pulse` / `data: <JSON of a compact event summary>`. A `: ping` comment every 15 s keeps proxies open.
- Support `Last-Event-ID` for a short replay (the last 100 events per project kept in memory).
- Pub/sub: an in-process `EventEmitter` keyed by project id; the ingest pipeline publishes after commit.
  At more than one API instance, swap in Postgres `LISTEN/NOTIFY` behind the same interface.
- Clean up on `request.raw.on("close")`. Never leak listeners (assert this in tests).

## 7. Database

Tables (`apps/api/src/db/schema.ts`): `projects`, `events` (raw, append-only,
PK `(project_id, id)`), `issues`, `api_requests`, `web_vitals`, plus the Better Auth
tables (`user`, `session`, `account`, `verification`) and `issue_users`.

- Always change the schema → `pnpm db:generate --name <change>` → review the SQL → commit the migration.
  Never edit an applied migration.
- Indexes follow the query patterns: project + time descending on every fact table.
- **Retention:** the free tier has limited storage. A daily job deletes `events`,
  `api_requests` and `web_vitals` older than `RETENTION_DAYS` (default 30), in batches.
- Timestamps are `timestamptz`, stored in UTC and rendered in the viewer's time zone.

## 8. Rate limiting, CORS, limits

- `@fastify/rate-limit` is registered with `global: false`. Ingest uses a per-key limit.
  Auth routes use a per-IP limit (10/min on sign-in). Query routes use a per-user limit.
- CORS: the ingest route allows any origin **without credentials** (the project allow-list is checked in
  the handler). Everything else allows only `DASHBOARD_ORIGINS`, with credentials.
- Helmet sets its default headers. The CSP is off because this is a JSON API.
- `bodyLimit` = `LIMITS.maxBatchBytes`. Per-event limit: 64 KB.

## 9. Testing

- `app.inject` for route tests (no network). Integration tests run against `pulseed_test`
  (created by docker compose): migrate once in `globalSetup`, truncate between tests.
- Required ingestion cases: 202 happy path; mixed valid and invalid events (`accepted`/`rejected` counts);
  401 for a bad key; 401 for a mismatched projectId; 403 for a disallowed origin; 413 for an oversized body; 400 for bad JSON;
  429 after the limit; idempotency (the same batch twice → counts unchanged); a gzip body; a zip bomb rejected;
  skew correction; issue regression (resolved → unresolved).
- Auth: sign-up, sign-in, sign-out, session required, cross-tenant access → 404.
- SSE: receives an event after ingest; listener removed on disconnect.
