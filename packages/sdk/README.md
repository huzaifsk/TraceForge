# @traceforge/sdk

Lightweight, privacy-first browser monitoring for [TraceForge](https://github.com/huzaifsk/TraceForge):
JavaScript errors, unhandled rejections, API failures, Core Web Vitals and navigation.

> **Pre-release.** Not yet published to npm; build and pack it locally (see the [root README](../../README.md#quick-start)).

```bash
npm install @traceforge/sdk
```

```ts
import { init } from "@traceforge/sdk"

init({
  dsn: "https://<publicKey>@traceforge.example.com/project/<projectId>",
  environment: "production",
})
```

- Zero runtime dependencies. ESM, CommonJS and a CDN build (`window.TraceForge`).
- Never throws into your app: invalid configuration logs one warning and disables monitoring.
- Privacy by default: no input values, cookies, headers or bodies; query-string values are redacted.

## React

`@traceforge/sdk/react` catches render errors `window.onerror` never sees. `react` is an
optional peer dependency — nothing here is pulled into the core bundle.

```tsx
import { TraceForgeErrorBoundary } from "@traceforge/sdk/react"

;<TraceForgeErrorBoundary fallback={<p>Something went wrong.</p>}>
  <App />
</TraceForgeErrorBoundary>
```

Reports the error with `mechanism: "error-boundary"` and the React component stack. `fallback`
can also be a function of `(error, reset)`, and `onError(error, componentStack)` fires alongside
the report for host-side handling (a toast, for example).

## Next.js

`@traceforge/sdk/next` reports crashes in Server Components, Route Handlers and Server Actions —
errors the browser SDK never sees. It's server-only and adds nothing to the browser bundle.

```ts
// instrumentation.ts (project root, not instrumentation-client.ts)
import { withTraceForge } from "@traceforge/sdk/next"

export const onRequestError = withTraceForge({
  dsn: "https://<publicKey>@traceforge.example.com/project/<projectId>",
  environment: "production",
})
```

Reports the error with `mechanism: "server"` and the route template Next.js provides (e.g.
`/orders/[id]`), reusing the same issue grouping, alerts and resolution workflow as browser errors.

MIT licensed.
