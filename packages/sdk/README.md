# @traceforge/sdk

Lightweight, privacy-first browser monitoring for [TraceForge](https://github.com/huzaifsk/TraceForge):
JavaScript errors, unhandled rejections, API failures, Core Web Vitals and navigation.

> **Pre-release.** Configuration and initialization are in place; the capture integrations are in progress.

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

MIT licensed.
