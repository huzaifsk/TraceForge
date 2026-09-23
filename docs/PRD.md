# PRD — Frontend Observability Platform

> Source of truth for **what** Pulseed is. Engineering decisions (the **how**)
> live in `.claude/skills/pulseed/`. When the two disagree, the PRD wins on
> product scope and the skill wins on implementation detail — and the conflict
> should be raised, not silently resolved.

## 1. Product Overview

**Product name:** Pulseed
**Type:** Open-source frontend observability platform
**Primary goal:** Allow frontend developers to monitor production applications for JavaScript errors, API failures, Web Vitals, performance issues, and user-impacting failures through a lightweight SDK and web dashboard.

The project should demonstrate strong frontend engineering rather than simply being another dashboard.

### Core product

```text
User's React / Next.js App
          │
          │ @pulseed/sdk
          ↓
   Browser Monitoring SDK
          │
          ├── JS Errors
          ├── Promise Errors
          ├── API Errors
          ├── Web Vitals
          ├── Performance
          ├── Navigation
          └── Device / Browser Context
          │
          ↓
      Ingestion API
          │
          ↓
       Database
          │
          ↓
   Pulseed Dashboard
```

---

# 2. Problem

Frontend applications fail in production in ways developers often cannot reproduce locally.

Examples:

- JavaScript exceptions
- Failed API requests
- slow API responses
- poor LCP/INP/CLS
- failed navigation
- browser-specific problems
- network failures
- intermittent errors
- errors affecting only a small percentage of users

Developers need a lightweight way to understand:

> **What failed, where did it fail, how often is it happening, and which users are affected?**

---

# 3. Goals

### Primary goals

1. Provide a lightweight JavaScript/TypeScript monitoring SDK.
2. Capture frontend errors automatically.
3. Monitor API requests.
4. Capture Core Web Vitals.
5. Capture browser performance metrics.
6. Send events reliably to a backend.
7. Provide a useful developer dashboard.
8. Support React and Next.js applications.
9. Minimize monitoring overhead.
10. Make the project completely usable on a free stack.

### Secondary goals

- Offline event buffering
- Event batching
- Retry mechanism
- Web Worker processing
- Source-map support
- Error grouping
- Performance trends
- Public demo application
- npm package

---

# 4. Non-Goals

The MVP should **not** attempt to become a full Sentry/Datadog replacement.

Do not initially build:

- Full session recording
- Infrastructure monitoring
- Server monitoring
- Kubernetes monitoring
- Distributed tracing
- Paid billing
- Enterprise SSO
- Complex alerting infrastructure
- AI-generated incident analysis

These can become future extensions.

---

# 5. Target Users

### Primary

Frontend developers working with:

- React
- Next.js
- JavaScript
- TypeScript

### Secondary

- Engineering leads
- QA engineers
- Small startups
- Indie developers

---

# 6. Core Features

## 6.1 Project Management

Users can create monitoring projects.

### Project

```text
Project
├── ID
├── Name
├── Platform
├── Environment
├── API Key
├── Created At
└── Status
```

Example:

```text
My E-commerce App
React / Next.js
Production
Project ID: pw_12345
```

### Environments

Support:

```text
Development
Staging
Production
```

---

# 7. SDK

Create an npm package:

```text
@pulseed/sdk
```

Installation:

```bash
npm install @pulseed/sdk
```

Initialization:

```typescript
import { init } from "@pulseed/sdk"

init({
  dsn: "https://pulseed.example.com/project/pw_xxx",
  environment: "production",
})
```

---

# 8. Error Monitoring

The SDK automatically capture:

### JavaScript errors

```javascript
window.onerror
```

Capture:

- error message
- stack
- filename
- line
- column
- browser
- OS
- URL
- timestamp

### Promise errors

Capture:

```javascript
window.onunhandledrejection
```

### React errors

Provide an Error Boundary:

```tsx
<PulseedErrorBoundary>
  <App />
</PulseedErrorBoundary>
```

Capture:

- component error
- stack
- component stack
- route
- environment

---

# 9. Error Grouping

Multiple identical errors should appear as one issue.

Example:

```text
TypeError: Cannot read properties of undefined
```

Instead of:

```text
1,284 individual errors
```

Dashboard:

```text
TypeError: Cannot read properties of undefined

Occurrences       1,284
Affected Users      318
First Seen          Sep 20
Last Seen           Sep 23
```

Grouping can initially use a fingerprint generated from:

```text
error type
+
error message
+
normalized stack trace
```

---

# 10. API Monitoring

The SDK should monitor:

```javascript
fetch()
```

and optionally:

```javascript
XMLHttpRequest
```

Capture:

```text
GET /api/orders

Status: 500
Duration: 1.8s
Method: GET
URL: /api/orders
Timestamp
```

Track:

- request count
- failure count
- status code
- latency
- endpoint
- HTTP method

### Dashboard

```text
API HEALTH

Endpoint             Requests   Errors   Avg Latency

/api/orders             12,421      84       240ms
/api/payment             4,102      31       610ms
/api/profile             9,812       2       120ms
```

---

# 11. Web Vitals

Capture:

- LCP
- INP
- CLS

Also capture:

- FCP
- TTFB
- page load
- DOM content loaded

Example:

```text
Web Performance

LCP       1.8s
INP       142ms
CLS       0.03
FCP       1.2s
TTFB      420ms
```

Provide ratings:

```text
Good
Needs Improvement
Poor
```

---

# 12. Navigation Monitoring

Track route/page changes.

Example:

```text
/dashboard
/orders
/orders/123
/settings
```

Capture:

- route
- navigation duration
- previous route
- timestamp

For SPA applications, integrate with:

- React Router
- Next.js navigation

---

# 13. User Context

Capture non-sensitive technical context:

```text
Browser
Chrome 153

OS
macOS

Device
Desktop

Viewport
1440 × 900

Language
en-IN

Connection
4G
```

Do **not** collect:

- passwords
- form contents
- authentication tokens
- cookies
- arbitrary personal information

---

# 14. Event Model

Every event should follow a common structure.

```typescript
interface MonitoringEvent {
  id: string
  projectId: string
  type: EventType
  timestamp: number

  environment: string

  page: {
    url: string
    path: string
  }

  device: {
    browser: string
    os: string
    deviceType: string
  }

  payload: unknown
}
```

Event types:

```typescript
type EventType =
  | "error"
  | "unhandled_rejection"
  | "api_error"
  | "api_request"
  | "web_vital"
  | "navigation"
  | "performance"
```

---

# 15. Event Batching

Do not send every event individually.

Instead:

```text
Event
 ↓
Memory Queue
 ↓
Batch
 ↓
POST /events
```

Example:

```text
Batch size: 20 events
OR
Flush after: 5 seconds
```

Whichever happens first.

This reduces network overhead.

---

# 16. Retry Mechanism

If the ingestion API fails:

```text
Send
 ↓
Failed
 ↓
Retry
 ↓
Retry
 ↓
Offline Storage
```

Use exponential backoff:

```text
1s
2s
4s
8s
```

Set a maximum retry count.

---

# 17. Offline Buffer

When the user is offline:

```text
Event
 ↓
IndexedDB
```

When connection returns:

```text
IndexedDB
 ↓
Batch
 ↓
Server
```

This is an important engineering feature for the project.

---

# 18. Web Worker

Move expensive processing away from the main thread.

Example:

```text
Main Thread
    │
    │ raw events
    ↓
Web Worker
    │
    ├── normalize
    ├── fingerprint
    ├── batch
    └── compress
    │
    ↓
API
```

The dashboard should include a benchmark demonstrating the difference between:

```text
SDK without Worker
vs
SDK with Worker
```

---

# 19. Ingestion API

Build a lightweight backend.

### Endpoint

```http
POST /api/v1/events
```

Request:

```json
{
  "projectId": "pw_123",
  "events": []
}
```

Responses:

```http
202 Accepted
```

Invalid payload:

```http
400 Bad Request
```

Invalid API key:

```http
401 Unauthorized
```

---

# 20. Dashboard

Build the dashboard with:

- Next.js
- TypeScript
- TailwindCSS
- shadcn/ui
- Recharts

### Main dashboard

```text
Pulseed
─────────────────────────────────────────

Project: BrandHub     Environment: Production

Errors          API Failures       Users
1,284            117               318

LCP              INP               CLS
1.8s             142ms             0.03

─────────────────────────────────────────

Error Trend
[          graph             ]

─────────────────────────────────────────

Top Issues

TypeError                    1,284
API Error 500                  117
ChunkLoadError                  83
```

---

# 21. Issues Page

```text
Issues

[Search] [Environment] [Browser] [Time]

TypeError                         1,284
API request failed                  117
ChunkLoadError                       83
Cannot read property                41
```

Clicking an issue:

```text
Issue Details

TypeError: Cannot read properties...

Occurrences: 1,284
Affected Users: 318

First seen
Sep 20

Last seen
Sep 23

Stack Trace

at OrdersTable.tsx:124
at Dashboard.tsx:42
...
```

---

# 22. Performance Page

Display:

```text
Performance

LCP
1.82s

INP
143ms

CLS
0.04
```

Allow filtering by:

- route
- browser
- device
- country/region where available
- date range

---

# 23. API Performance Page

```text
API Performance

/api/orders

Requests       12,421
Error rate      0.67%
Avg latency     240ms
P95 latency     710ms

[Latency graph]
```

---

# 24. Real-Time Event Stream

Provide an optional live event view:

```text
LIVE EVENTS

14:32:21  ERROR       /checkout
14:32:22  API 500     /api/payment
14:32:24  WEB VITAL   /home
14:32:27  ERROR       /orders
```

Use:

```text
Server-Sent Events
```

or WebSocket if needed.

For the MVP, SSE is sufficient.

---

# 25. Demo Application

Create a separate application specifically designed to demonstrate Pulseed.

It should contain intentional problems:

```text
Demo App

[Trigger JS Error]
[Trigger API Error]
[Slow API]
[Slow Render]
[Large Image]
[Layout Shift]
[Offline Mode]
```

When the recruiter clicks:

```text
Trigger API Error
```

the dashboard should immediately show the event.

This makes the project extremely easy to demonstrate during interviews.

---

# 26. Technology Stack

## Frontend

```text
Next.js
React
TypeScript
TailwindCSS
shadcn/ui
Recharts
```

## SDK

```text
TypeScript
Web APIs
IndexedDB
Web Workers
Performance API
```

## Backend

For the free version:

```text
Node.js
Fastify / Express
PostgreSQL
```

Potential free hosting:

```text
Cloudflare Pages
Cloudflare Workers
Neon
Supabase
```

Use the free tiers and design the application so it doesn't depend on paid infrastructure.

---

# 27. Monorepo Structure

Use:

```text
pulseed/
│
├── apps/
│   ├── dashboard/
│   ├── demo/
│   └── api/
│
├── packages/
│   ├── sdk/
│   ├── shared/
│   ├── event-schema/
│   └── ui/
│
├── docs/
│
├── package.json
├── turbo.json
└── README.md
```

Use:

```text
pnpm
Turborepo
```

---

# 28. Database

Core tables:

```text
projects
users
events
issues
api_requests
web_vitals
```

### Events

```text
id
project_id
type
fingerprint
timestamp
environment
payload
created_at
```

### Issues

```text
id
project_id
fingerprint
title
first_seen
last_seen
occurrence_count
affected_users
status
```

---

# 29. Authentication

Dashboard authentication:

```text
Email
Password
```

For MVP, use an existing authentication provider with a free tier or implement simple authentication.

SDK authentication should use:

```text
Project DSN / public ingestion key
```

Never expose dashboard administrative credentials to the SDK.

---

# 30. Security Requirements

The platform must:

- validate incoming payloads
- rate-limit ingestion
- authenticate projects
- sanitize stack traces
- limit payload size
- prevent arbitrary HTML rendering
- never store passwords
- never store auth tokens
- never collect form values by default

SDK payload limit:

```text
Maximum event size: 64 KB
```

---

# 31. Performance Requirements

SDK overhead should be extremely low.

Target:

```text
<1% CPU overhead during normal usage
```

Network:

```text
Batch events
Compress payloads
Use keepalive where appropriate
```

The SDK must never block the main application thread for monitoring work.

---

# 32. Privacy

Default collection should be technical rather than personal.

Do not capture:

```text
<input> values
passwords
cookies
authorization headers
localStorage contents
```

Provide:

```typescript
privacy: {
  captureUserContext: false
}
```

by default.

---

# 33. Testing

### SDK

- Unit tests
- Integration tests
- browser tests

### Dashboard

- Component tests
- integration tests

### API

- ingestion tests
- authentication tests
- rate-limit tests

Recommended:

```text
Vitest
React Testing Library
Playwright
```

---

# 34. CI/CD

GitHub Actions:

```text
Pull Request
     │
     ├── TypeScript check
     ├── ESLint
     ├── Unit tests
     ├── Build
     └── Playwright
          │
          ↓
       Deploy
```

---

# 35. Documentation

README should contain:

1. **Problem** — what Pulseed solves.
2. **Quick Start** — `npm install @pulseed/sdk`
3. **Setup** — `init({...})`
4. **Architecture** — diagram.
5. **Event lifecycle** — `Browser → SDK → Queue → Worker → API → DB → Dashboard`
6. **Performance benchmark** — show monitoring overhead.
7. **Privacy** — clearly document collected data.
8. **Contributing** — open-source contribution instructions.

---

# 36. MVP

The first release should contain only:

### SDK

- initialization
- JS error capture
- unhandled rejection capture
- API monitoring
- Web Vitals
- batching

### Backend

- project creation
- API key
- event ingestion
- event storage

### Dashboard

- overview
- issues
- issue details
- API monitoring
- Web Vitals

### Demo

- trigger error
- trigger API failure
- trigger performance problem

---

# 37. Phase 2

Add:

- IndexedDB offline queue
- retry mechanism
- Web Worker
- real-time events
- advanced filtering
- performance trends
- source maps
- React Error Boundary
- Next.js integration

---

# 38. Phase 3

Add:

- alert rules
- GitHub integration
- Slack/webhook notifications
- release tracking
- regression detection
- deployment comparison
- error resolution workflow

---

# 39. Phase 4 — Advanced Differentiator

Add an **Engineering Insights** section.

Instead of simply saying:

```text
LCP = 4.2s
```

show:

```text
Performance Investigation

LCP increased 42% after release v2.8.1.

Likely contributors:

1. /products route
2. 780KB JavaScript increase
3. Third-party analytics script
```

Keep this rule-based initially rather than requiring paid AI APIs.

---

# 40. Resume Positioning

Once genuinely implemented, the project could appear as:

**Pulseed — Open Source Frontend Observability Platform**

> Built a TypeScript frontend observability SDK and Next.js dashboard capturing JavaScript errors, API failures, Web Vitals and navigation performance; implemented event batching, IndexedDB offline buffering and Web Worker processing to minimize monitoring overhead.

> Architected a scalable event-ingestion pipeline with error fingerprinting, issue aggregation, API latency tracking and real-time event visualization, with React/Next.js demo integrations for production-style debugging.

> Published the SDK as an npm package with automated testing, documentation and CI/CD, including privacy-first telemetry controls and configurable event collection.
