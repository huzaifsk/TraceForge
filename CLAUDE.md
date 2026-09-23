# TraceForge

Open-source frontend observability: a browser SDK, a Fastify ingestion/query API and a
Next.js dashboard, in a pnpm + Turborepo monorepo.

**Before any work in this repo, load the `traceforge` skill** (`.claude/skills/traceforge/SKILL.md`).
It holds the architecture decisions, dependency rules, roadmap, specs and definition of done.
Product scope lives in `docs/PRD.md`.

## Non-negotiables

- Quality bar: senior-engineer, open-source-flagship quality. Correct, tested, typed, accessible, pixel-perfect.
- `pnpm check` must be green before you say a task is done. Report failures honestly.
- The SDK never throws into the host app, never blocks the main thread, has zero runtime
  dependencies (the build enforces it) and is privacy-first by default.
- The SDK imports only `@traceforge/event-schema/constants`, `/types` and `@traceforge/shared`, never the Zod root.
- The API owns the database; the dashboard never imports drizzle or postgres.
- UI: shadcn **Base UI** (`render` prop, never `asChild`). Use the `shadcn`, `emil-design-eng` and
  `dataviz` skills. Semantic tokens only.
- Next.js 16 differs from older versions: read `apps/dashboard/node_modules/next/dist/docs/` before using a Next API.
- Pinned on purpose: TypeScript ~6.0 (typescript-eslint limit) and ESLint 9 (eslint-plugin-react limit).

## Commands

```bash
pnpm install && pnpm db:up && pnpm db:migrate
pnpm dev        # api :4000 · dashboard :3000 · demo :3001
pnpm check      # format + lint + typecheck + test + build
```
