# Dashboard — `apps/dashboard` (and the UI of `apps/demo`)

The dashboard is what people judge TraceForge by. The target feel is **calm, dense and
precise**: the craft of Linear, Vercel and Sentry, not a template. Every pixel is intentional.

Before building UI, load the **`shadcn`** skill (component rules) and the
**`emil-design-eng`** skill (polish and motion). Before any chart, load the **`dataviz`** skill.

## Contents
1. Stack and conventions
2. Design system (tokens, type, spacing, color, motion)
3. App shell and information architecture
4. Screens
5. States: loading, empty, error
6. Formatting
7. Charts
8. Accessibility
9. Responsive behavior
10. Data fetching and URL state
11. Testing

---

## 1. Stack and conventions

- Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui **Base UI** (`base-nova`), lucide icons, Recharts through shadcn `chart`.
- **Read `node_modules/next/dist/docs/` before using a Next API.** Next 16 renamed `middleware` to `proxy`, and `params`/`searchParams` are Promises.
- Components come from `@traceforge/ui/components/*` (added with the shadcn CLI run from
  `apps/dashboard`). App-specific composites live in `apps/dashboard/components/`.
- Server Components by default. `"use client"` only at the leaves that need interactivity.
- Base UI composition uses the `render` prop (`<Button render={<Link href="/x" />} nativeButton={false}>`), **never `asChild`**.
- Follow the shadcn skill's critical rules, in particular: semantic tokens only (no raw
  colors, no `dark:` color overrides); `gap-*`, not `space-*`; `size-*`; `cn()`; full Card
  composition; `Empty`, `Skeleton`, `Badge`, `Alert` and `Separator` instead of custom markup;
  Dialog, Sheet and Drawer always get a Title.

## 2. Design system

Tokens live in `packages/ui/src/styles/globals.css`. **Never hard-code a color, radius
or easing in a component.**

**Typography.** Geist Sans for UI, Geist Mono for code, ids, stack traces and endpoints.

| Role | Class |
|---|---|
| Page title | `text-xl font-semibold tracking-tight` |
| Section title / card title | `text-sm font-medium` |
| Body | `text-sm` |
| Secondary / meta | `text-xs text-muted-foreground` |
| KPI value | `text-2xl font-semibold tracking-tight` (proportional figures) |
| Table numbers, axis ticks, timestamps | `tabular-nums` |
| Code, stack frames, endpoints | `font-mono text-xs` |

**Spacing.** A 4 px grid. Page padding is `p-6` at ≥ 1024 px and `p-4` below that. The gap between cards is `gap-4`.
Card inner padding is left to the Card component; don't override it. Sidebar width: 240 px expanded, 48 px collapsed.

**Color jobs.** Status colors come in two steps: `status-*` for fills, bars and dots, and
`status-*-text` (≥ 4.5:1 on every surface) for status-colored **text and icons**. Never put `status-*` on text.

- Neutral surfaces and ink: `background`, `card`, `muted`, `foreground`, `muted-foreground`, `border`.
- **Status** (Web Vitals rating, health, severity): `status-good`, `status-warning`,
  `status-serious`, `status-critical`. Always paired with an **icon + label**, never color alone.
  Web Vitals: good → `status-good`, needs improvement → `status-warning`, poor → `status-critical`.
- **Series** (charts): `chart-1` … `chart-5` in fixed order, assigned per entity and never by rank.
- `destructive` is only for destructive actions (delete project, rotate key), not for "error" data.

**Radius.** From `--radius` via `rounded-md`/`lg`/`xl`. Never use arbitrary values.

**Motion** (the Emil rules, non-negotiable):
- Ask first whether the element should animate at all. Keyboard-driven and high-frequency actions
  (the command menu, list navigation, the theme toggle) **don't animate**.
- Enter and exit use `ease-out` (`var(--ease-out)`); on-screen movement uses `var(--ease-in-out)`. Never use `ease-in`.
- Durations: press feedback 120–160 ms; tooltips 125–200 ms; popovers and menus 150–250 ms; sheets and dialogs 200–300 ms.
- Animate only `transform` and `opacity`. Never `transition: all`. Never scale from 0 (start at 0.95 and opacity 0).
- Popovers scale from their trigger (`transform-origin: var(--transform-origin)`); dialogs stay centered.
- Pressable elements get `active:scale-[0.97]`. Hover effects are gated by `@media (hover: hover) and (pointer: fine)`.
- Respect `prefers-reduced-motion`: keep opacity changes and remove movement.
- New live-stream rows fade and slide 4 px in over 180 ms. No stagger on data tables.

**Icons.** lucide at 16 px (`size-4`), `strokeWidth` at its default. Use the `data-icon`
attributes inside buttons, following the shadcn icons rule.

## 3. App shell and information architecture

```text
/                                                landing page (static; components/landing/*)
/login  /signup                                  (auth layout: centered card, logo, 400px)
/projects                                        project list + "New project"
/projects/new                                    create → onboarding
/p/[projectId]/                                  (app layout)
  overview                                       default landing
  issues            issues/[issueId]
  performance                                    Web Vitals
  api               api/[endpoint]               API performance
  live                                           real-time stream
  benchmark                                      worker vs main-thread (Phase 2)
  settings                                       general · DSN & keys · allowed origins · danger zone
```

The **shell** is the shadcn `Sidebar` (collapsible to icons, `Cmd+B`) plus a 56 px top bar. The top bar holds:
- a breadcrumb: project switcher (`Popover` + `Command`) › page title
- an **Environment** selector (`Select`: Production, Staging, Development)
- a **time range** picker with presets (1 h, 24 h, 7 d, 30 d, custom), following the dataviz filter spec
- (the live connection indicator lives on the Live page, so other pages don't hold an SSE connection open)
- the user menu (theme: light, dark, system; sign out)

The environment and range live in the **URL** (`?env=production&range=24h`) and persist across pages.

`Cmd+K` opens a command menu: navigate to pages and issues, switch projects, copy the DSN, toggle the theme.
It has no open or close animation.

## 4. Screens

### Landing (`/`)
Static and fast, because a monitoring product must have good Web Vitals itself. It has:
- a header with anchor links and Sign in / Get started
- a hero with the value proposition, CTAs and the install command
- a **real** product screenshot in both themes (`public/landing/overview-{light,dark}.png`, regenerated
  from the seeded dashboard at 1440×900 @2x)
- factual stats, features, the 3-step setup with real code, the privacy lists, a final CTA and a footer

Every claim on it must be true of the code. Update it when a number (for example the SDK size) changes.

### Overview (PRD §20)
Row 1, four KPI stat tiles: **Errors**, **API failures**, **Users**, **Error rate**.
Each shows the value, the delta against the previous equal period (the delta color follows good/bad
direction, with an arrow icon and the percentage), and a 24-point sparkline.

Row 2, three Web Vitals tiles: **LCP, INP, CLS** at p75, each with its rating badge
(icon + label) and a thin three-segment distribution bar (good, needs improvement, poor, as a percentage of loads).

Row 3: the **Error trend** area chart (errors and unhandled rejections as two series, with a crosshair tooltip), with **Top issues** beside it (5 rows: title, count, sparkline; clicking a row opens the issue).

Row 4: **Slowest endpoints** (top 5 by p95) and **Top failing endpoints** (top 5 by error count).

### Issues (PRD §21)
- Toolbar: search (`InputGroup` with a search icon, debounced 200 ms, synced to the URL), a status
  `ToggleGroup` (Unresolved, Resolved, Ignored), a Browser filter, and sort (Last seen, Occurrences, Users).
- Table columns: issue (type in medium weight, message truncated, culprit in mono muted) · a
  24-bar occurrence sparkline · Events · Users · First seen · Last seen (relative, absolute on tooltip).
- Keyset pagination with "Load more". Row hover shows `bg-muted/50`. The whole row is a link. `j`/`k` move between rows and `Enter` opens.

### Issue detail
- Header: the title (`name: message`, wraps up to 3 lines), the culprit, status actions
  (`Resolve`, `Ignore` via `ButtonGroup`), and meta badges (environment, first release seen).
- Stat strip: Occurrences · Users · First seen · Last seen.
- An occurrences-over-time bar chart.
- **Stack trace**: frames in mono. In-app frames at full contrast; third-party frames
  collapsed into "N library frames" toggles. Each frame shows `function` then `file:line:col`.
  The component stack for boundary errors appears in a separate tab. **All rendered as text.**
- Breakdown cards: Browser, OS, Device, Route (top values as horizontal bars with percentages).
- Latest event: page URL, timestamp, device context in a description list.

### Performance: Web Vitals (PRD §22)
- Filters: route, browser, device type, date range.
- Five vital cards (LCP, INP, CLS, FCP, TTFB): the p75 value, rating, threshold hint
  ("Good ≤ 2.5 s"), and the distribution bar.
- A p75 trend line chart per vital with the good and poor thresholds drawn as dashed
  reference lines. One vital at a time via `Tabs`, which avoids a dual axis.
- A "Slowest routes" table: route, p75 LCP, p75 INP, p75 CLS, and page loads, sortable.

### API performance (PRD §23)
- A table: endpoint (mono), method badge, Requests, Errors, Error rate, Avg, P95, and a latency sparkline.
- Endpoint detail: a stat strip (Requests, Error rate, Avg latency, P95 latency), a latency chart
  (p50 and p95 lines), a status code breakdown (2xx, 3xx, 4xx, 5xx, network), and recent failures.

### Live (PRD §24)
A virtualized list, newest first, capped at 500 rows. Each row shows the time (`HH:mm:ss`, tabular), a
type badge (Error, API 500, Web vital, Navigation), the path in mono, and a summary.
A pause/resume toggle holds incoming rows and shows a "N new events" pill. There's a connection state with
automatic reconnect using backoff.

### Onboarding (a new project)
Step 1: name and platform (React, Next.js, JavaScript). Step 2: install (`npm i @traceforge/sdk`)
plus the init snippet with the real DSN, in a code block with a copy button (Next.js shows the `instrumentation-client.ts` variant).
Step 3: "Waiting for your first event…", driven by the SSE stream, which flips to a success state with a link to the event.

### Settings
General (name, platform), **DSN & keys** (a masked key with reveal and copy, "Rotate key" with a confirm
dialog that explains the consequences), **Allowed origins** (a tag input), and **Danger zone** (delete the project,
with a confirmation that requires typing the name).

## 5. States: loading, empty, error

Every data surface implements all three states. This is not optional.
- **Loading:** a `Skeleton` in the exact shape of the final content, so nothing shifts when data arrives (CLS 0). Use a
  Next `loading.tsx` per route segment plus Suspense boundaries per card, so one slow query doesn't block the page.
- **Empty:** the `Empty` component with an icon, a one-line title, a helpful sentence and an action.
  A project with no events shows the install snippet. A filter with no matches offers "Clear filters".
- **Error:** an inline `Alert` in the card with a retry button. Route-level `error.tsx` catches the rest.
  Never show raw error messages from the server.

## 6. Formatting

Put the formatters in `apps/dashboard/lib/format.ts`, built on `Intl`, and test them.
- Counts: `1,284` in tables and `12.4k` in KPI tiles and axes (`Intl.NumberFormat`, compact notation).
- Durations: < 1 s → `142 ms`; ≥ 1 s → `1.82 s`. CLS is unitless with 2 decimals (`0.03`).
- Percentages: `0.67%` (2 significant digits below 1%, otherwise 1 decimal).
- Time: relative ("3m ago", "2d ago") with the absolute local time in a tooltip; charts use local time.
- Endpoints, file paths and ids are always mono. Truncate in the middle for long paths and show the full value in a tooltip.

## 7. Charts

Follow the `dataviz` skill in full. Project specifics:
- Use shadcn `chart` (`ChartContainer`, `ChartTooltip`, `ChartLegend`) with a `ChartConfig`
  mapping series to `var(--chart-N)`.
- Line 2 px; area fill at 10–15% opacity; bars with 4 px rounded data ends and 2 px gaps.
  Grid in `var(--chart-grid)`, horizontal lines only; axes in `var(--chart-axis)`; axis text in `muted-foreground`.
- Every chart has a hover layer: a crosshair and tooltip for lines and areas, a per-bar tooltip for bars.
- A legend whenever there are 2 or more series. Never a dual y-axis.
- The empty-bucket fill comes from the API, so lines never interpolate across missing data.
- Each chart has an accessible name and a visually hidden data table, or a "View as table" toggle.

## 8. Accessibility (WCAG 2.2 AA)

- Everything works by keyboard with visible focus rings (the tokens already style `focus-visible`).
- Status and trend meaning always has text and an icon, not color alone.
- Text contrast is at least 4.5:1, and UI elements and chart marks at least 3:1 against their surface.
- Landmarks: `nav` (sidebar), `header` (top bar), `main`. One `h1` per page.
- Live region: the Live page announces "N new events" politely, never per row.
- Run axe checks in Playwright on every screen, in both themes.

## 9. Responsive behavior

| Width | Behavior |
|---|---|
| ≥ 1280 | full layout, sidebar expanded |
| 1024–1279 | sidebar collapsed to icons; KPI grid 4 columns |
| 768–1023 | KPI grid 2 columns; tables hide low-priority columns (sparkline, first seen) |
| < 768 | the sidebar becomes a `Sheet`; stacked cards; tables hide secondary columns; global filters move to a scrollable second row under the top bar |

Verify at 1440, 1024, 768 and 390 px. No horizontal page scroll at any width.
Apply the `mobile-native` skill checks for phone widths.

## 10. Data fetching and URL state

- Server Components fetch from the API with the incoming cookies forwarded
  (`headers()` → `cookie`). A tiny typed client lives in `apps/dashboard/lib/api.ts` and validates responses with the shared Zod schemas.
- `next.config.ts` `rewrites()` proxy `/api/:path*` → `${API_URL}/api/:path*`, so the browser only ever talks same-origin (ADR 9).
- Filters (environment, range, search, status, sort) are **URL search params**, the single source of truth. They are shareable and survive back and forward.
- Mutations (resolve an issue, rotate a key) are optimistic, with rollback on failure and a toast.
- Live data: an `EventSource` hook with reconnect and backoff that pauses while the tab is hidden.

## 11. Testing

- Component tests (Vitest + React Testing Library): formatters, stat tiles (delta direction), the
  stack trace (third-party collapse, text rendering of hostile input such as `<img onerror>`), and filter URL sync.
- Playwright: sign up → create a project → ingest via the API → see the issue → resolve it. The live stream receives
  an event. Axe on every page. Screenshots in light and dark at 1440 and 390.
- The dashboard runs the TraceForge SDK on itself in production (dogfooding).
