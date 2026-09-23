# Demo app — `apps/demo`

The demo is the interview weapon (PRD §25). A viewer clicks a button, and the failure
appears in the dashboard seconds later. It must be **honest**: every trigger causes
a real failure that the real SDK captures through its normal code paths. There are no fake
events posted directly to the API.

## Setup

- Next.js 16 on port 3001. The SDK is initialized in `apps/demo/instrumentation-client.ts` with
  `NEXT_PUBLIC_PULSEED_DSN`, `environment: "development"` locally and `"production"` when deployed.
- The demo's own route handlers under `app/api/demo/*` produce the failing and slow responses.
- `debug: true` in development, so the console shows what the SDK does.

## Layout

A single page, max width 960 px, with a header ("Pulseed Demo: break things on purpose")
and a link to the dashboard project. There's a grid of trigger cards (2 columns at ≥ 768 px, 1 below).
Each card has an icon, a title, one sentence about what will happen, the event type it
produces (a `Badge`: `error`, `api_error`, `web_vital`, …), and a button.

A **session log** panel on the right (below the grid on mobile) lists what this tab has captured,
fed by the SDK's `beforeSend` hook: the time, the type and a summary. The viewer sees the
pipeline working without opening the dashboard. (Delivery status would need a public SDK
callback; add one only if there is a second use for it.)

## Triggers

| Trigger | Implementation | Produces |
|---|---|---|
| **Trigger JS Error** | a click handler reads a property of `undefined` (a real `TypeError`) | `error` |
| **Unhandled rejection** | `Promise.reject(new Error("Payment provider timeout"))` with no catch | `unhandled_rejection` |
| **Trigger API Error** | `fetch("/api/demo/orders?fail=1")` → the route returns 500 | `api_error` (http) |
| **Slow API** | `fetch("/api/demo/slow?ms=2400")` → the route awaits, then returns 200 | `api_request`, ~2.4 s |
| **Network failure** | `fetch("https://unreachable.invalid/")` | `api_error` (network) |
| **Slow Render** | a state toggle renders a component that blocks the main thread for about 400 ms (a busy loop) | poor `INP` on the next interaction |
| **Large Image** | `/large-image`: a detailed hero image that arrives after 4.5 s (`/api/demo/slow-image`). It must be detailed: Chrome ignores low-entropy images as LCP candidates | poor `LCP` (~4.6 s) |
| **Layout Shift** | `/layout-shift`: a promo banner at 1 s and a notice at 1.8 s, with no reserved space | poor `CLS` (~0.29) |
| **React crash** (Phase 2) | a component throws during render inside `PulseedErrorBoundary` | `error` (error-boundary) |
| **Offline Mode** (Phase 2) | instructions plus a toggle: trigger errors while offline, go online, and watch the replay | offline buffer replay |
| **Navigate** | links to `/orders`, `/orders/123` and `/settings` | `navigation` |

Web Vitals only finalize when the page is hidden. The copy on the LCP, CLS and INP cards says
"switch tabs or reload to send", and the dashboard shows them after the flush.

## Rules

- Guard every trigger so it can't crash the demo itself. Errors propagate to `window` because
  that is what we want the SDK to catch, but the page stays usable. React render crashes (Phase 2) are
  caught by a boundary with a "Reset" button.
- No trigger may exfiltrate anything. The demo contains no real user data.
- The visual quality bar is the same as the dashboard's: the same UI package, tokens and states.
