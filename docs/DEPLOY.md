# Deploying TraceForge

TraceForge runs on free tiers:

| Part                         | Host       | Why                                                                                              |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| Dashboard (`apps/dashboard`) | **Vercel** | Next.js, same-origin proxy to the API                                                            |
| Demo (`apps/demo`)           | **Vercel** | Next.js                                                                                          |
| API (`apps/api`)             | **Render** | A long-running Node server: live SSE streams and in-memory caches don't fit serverless functions |
| Database                     | **Neon**   | Serverless Postgres                                                                              |

Deploy in this order: database → API → dashboard → demo.

## 1. Database (Neon)

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string. It must end with `?sslmode=require`.
3. Note the region. `render.yaml` uses Render's `ohio` region to match Neon's AWS `us-east-2`; if your
   Neon project is elsewhere, change `region:` in `render.yaml` to the nearest Render region first.

## 2. API (Render)

1. At [render.com](https://render.com): **New → Blueprint**, then pick this repository. Render reads `render.yaml`.
2. Fill in the three variables it asks for:
   - `DATABASE_URL`: the Neon string from step 1.
   - `PUBLIC_API_URL`: the service's own URL, e.g. `https://traceforge-api.onrender.com`. It's shown after the first deploy; set it and redeploy.
   - `DASHBOARD_ORIGINS`: your Vercel dashboard URL from step 3, e.g. `https://thetraceforge.vercel.app`.
3. Deploy. Migrations run automatically at startup (`MIGRATE_ON_START=true`). `https://<api>/ready` should return `{"status":"ready"}`.

> The free plan sleeps after 15 minutes idle, and the first request after that takes about 30–60 s.
> The SDK retries with backoff, so events aren't lost to one slow wake-up. For always-on, use the
> $7 plan (then you can move migrations to a pre-deploy command and remove `MIGRATE_ON_START`).

**Troubleshooting: sign-in fails with `INVALID_ORIGIN` (403).** `DASHBOARD_ORIGINS` must be the
**full origin including the scheme** (`https://thetraceforge.vercel.app`), not a bare host
(`thetraceforge.vercel.app`) and not with a trailing slash — it is compared byte-for-byte against
the browser's `Origin` header. A bad value fails the API at _startup_ (visible as the deploy going
red, and in the logs as `Invalid environment configuration: DASHBOARD_ORIGINS...`), never as a
silently broken deploy — `apps/api/src/env.ts` validates this. Check the `config: sign-in is
accepted only from dashboardOrigins` line near the top of the Render logs to see the exact value
the running service has.

## 3. Dashboard (Vercel)

1. **Add New → Project**, then import this repository.
2. **Root Directory:** `apps/dashboard` (Framework Preset: Next.js). `vercel.json` sets the install and build
   commands for the monorepo with the exact pnpm version the lockfile needs, and an `ignoreCommand`
   (`turbo query affected`) so Vercel skips rebuilding the dashboard on commits that only touch
   `apps/api` or `apps/demo` — leave Build and Output Settings alone.
3. Environment variables:
   - `API_URL`: the Render URL, e.g. `https://traceforge-api.onrender.com`
4. Deploy, then add the dashboard URL to `DASHBOARD_ORIGINS` on Render if you haven't yet.

The browser only ever talks to the dashboard's own domain: `/api/*` is proxied to Render, so
sign-in cookies are first-party. The live stream reconnects by itself (resuming where it left off)
whenever a serverless function reaches its time limit.

## 4. Demo (Vercel, optional)

1. A second Vercel project from the same repository, with **Root Directory** `apps/demo`.
2. Sign up on your deployed dashboard, create a project, and copy its DSN.
3. Environment variables:
   - `NEXT_PUBLIC_TRACEFORGE_DSN`: that DSN (it will point at your Render API)
   - `NEXT_PUBLIC_DASHBOARD_URL`: your dashboard URL

## 5. Publishing the SDK to npm

1. On [npmjs.com](https://www.npmjs.com), create the free organization **`traceforge`**.
2. Create an **Automation** access token (Account → Access Tokens).
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, named `NPM_TOKEN`.
4. Release:

   ```bash
   git tag sdk-v0.1.0 && git push origin sdk-v0.1.0
   ```

   `.github/workflows/release-sdk.yml` checks that the tag matches `packages/sdk/package.json`,
   builds, tests, checks the size budget, and publishes with provenance.

For later releases, bump `version` in `packages/sdk/package.json`, commit, and push a matching `sdk-vX.Y.Z` tag.
