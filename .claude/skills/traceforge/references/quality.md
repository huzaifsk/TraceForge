# Quality: testing, CI, docs, release, review

## Test strategy

| Layer | Tool | What |
|---|---|---|
| Pure logic (`shared`, `event-schema`, formatters) | Vitest | Exhaustive: edge cases, malicious input, boundaries (exactly at the limit, limit + 1) |
| SDK units | Vitest + happy-dom | Integrations, pipeline, queue timers (`vi.useFakeTimers`), patch/unpatch safety |
| SDK in real browsers | Playwright (Chromium, Firefox, WebKit) | The IIFE build on a fixture page → a stub ingest server; vitals; offline replay |
| API routes | Vitest + `app.inject` | Status codes, validation, auth, rate limits |
| API + DB | Vitest against `traceforge_test` | Idempotency, issue upsert, aggregations, retention |
| Dashboard components | Vitest + React Testing Library | Rendering, states, hostile input rendered as text |
| End to end | Playwright | Demo trigger → dashboard shows it; auth flows; axe; light and dark screenshots |

Rules:
- Test behavior, not implementation. Name tests as specifications ("groups the same error across deploys").
- Every bug fix starts with a failing test.
- No snapshot tests of large objects. Assert on the fields that matter.
- No sleeps. Use fake timers, `expect.poll`, or Playwright auto-waiting.
- Tests must pass offline, except the ones that need Docker Postgres. Those are tagged, and they skip with a clear message when the DB is unavailable locally. They **never** skip in CI.

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

1. install (pnpm, frozen lockfile, cache)
2. `pnpm format:check`
3. `turbo run lint typecheck test build` (with a Postgres 17 service container for the API tests)
4. SDK `size-limit`
5. Playwright (later milestones), with its report uploaded as an artifact

Deploy only from `main` after CI is green. PRs get preview deploys when the host supports them.

## Commits and PRs

- Conventional Commits (`feat(sdk): capture unhandled rejections`, `fix(api): …`). Scopes:
  `sdk`, `api`, `dashboard`, `demo`, `schema`, `shared`, `ui`, `repo`, `docs`, `ci`.
- One logical change per PR. The description covers what, why, how it was verified, and screenshots for UI.
- Changes to `packages/sdk` or `packages/event-schema` that affect consumers include a
  Changeset (`pnpm changeset`) once Changesets is set up (milestone M4).

## Releasing the SDK

- Changesets version the packages → the release workflow publishes with `--provenance`.
- Semver: any change to exported types, option defaults or the wire format is at least minor. Removals are major.
- The SDK README covers install, init (plain, React and Next.js), every option, the data collected, the privacy guarantees, CSP notes (`connect-src`, `worker-src blob:`), and bundle size.

## Documentation

The root `README.md` follows PRD §35: the problem, quick start, setup, an architecture
diagram, the event lifecycle, the performance benchmark (real numbers only), privacy (an exact
list of what is and isn't collected), and contributing. Keep it accurate. It's the first thing people read.

## Review checklist

Correctness
- [ ] Handles null, empty, huge, concurrent and offline cases. No unhandled promise.
- [ ] Idempotent where retries can happen. Time zones are correct.

Security and privacy
- [ ] All external input is validated at the boundary. Nothing user-controlled is rendered as HTML.
- [ ] No new data is collected without justification. Query strings and tokens are redacted. Nothing secret is logged.
- [ ] Authorization is checked on every project-scoped route (cross-tenant → 404).

Performance
- [ ] The SDK size budget holds. No main-thread work that isn't needed. No N+1 queries; aggregations are in SQL.
- [ ] Dashboard pages are streamed with Suspense. No layout shift on data load.

UI craft
- [ ] Matches `references/dashboard.md`. Light and dark themes. 1440, 1024, 768 and 390 px.
- [ ] Loading, empty and error states. Keyboard and screen reader. Axe clean.
- [ ] Motion follows the Emil rules (run the `review-animations` skill on motion changes).

Code
- [ ] Reads like its neighbors. Types are precise (no `any`, no unsafe casts). Comments explain why.
- [ ] Tests cover the behavior and its failure modes. `pnpm check` is green.
