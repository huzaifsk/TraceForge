import { Card, CardContent } from "@traceforge/ui/components/card"
import type { Metadata } from "next"
import Link from "next/link"

import { CodeBlock } from "@/components/code-block"
import { GITHUB_URL, SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"

export const metadata: Metadata = {
  title: "Guide",
  description:
    "Install the TraceForge SDK, capture errors in React and Next.js, and configure alerts, releases and privacy — a complete guide to open-source frontend observability.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "TraceForge guide",
    description: "Install the SDK, capture server-side errors, and configure alerts and releases.",
    images: [{ url: "/landing/overview-light.png", width: 2880, height: 1800 }],
  },
}

const CONTENTS = [
  { href: "#install", label: "Install & initialize" },
  { href: "#react", label: "React error boundary" },
  { href: "#nextjs", label: "Next.js server errors" },
  { href: "#configuration", label: "Configuration" },
  { href: "#alerts", label: "Alerts & webhooks" },
  { href: "#releases", label: "Releases" },
  { href: "#self-hosting", label: "Self-hosting" },
] as const

const INIT_CODE = `// instrumentation-client.ts (Next.js) or your app's entry point
import { init } from "@traceforge/sdk"

init({
  dsn: process.env.NEXT_PUBLIC_TRACEFORGE_DSN!,
  environment: "production",
})`

const REACT_CODE = `import { TraceForgeErrorBoundary } from "@traceforge/sdk/react"

;<TraceForgeErrorBoundary fallback={<p>Something went wrong.</p>}>
  <App />
</TraceForgeErrorBoundary>`

const NEXT_CODE = `// instrumentation.ts (project root, not instrumentation-client.ts)
import { withTraceForge } from "@traceforge/sdk/next"

export const onRequestError = withTraceForge({
  dsn: process.env.NEXT_PUBLIC_TRACEFORGE_DSN!,
  environment: "production",
})`

const CONFIG_CODE = `init({
  dsn: process.env.NEXT_PUBLIC_TRACEFORGE_DSN!,
  environment: "production",
  release: process.env.NEXT_PUBLIC_COMMIT_SHA,

  // Monitor a fraction of sessions. Default: 1.
  sampleRate: 0.5,

  // Drop noisy or third-party errors before they're even queued.
  ignoreErrors: ["ResizeObserver loop", /^Network request failed/],

  // Static tags attached to every event.
  tags: { team: "checkout" },

  // A random, non-personal id so the dashboard can count affected users.
  privacy: { captureUserContext: true },

  // Last chance to redact or drop (return null) an event.
  beforeSend(event) {
    return event
  },
})`

interface ConfigRow {
  option: string
  description: string
}

const CONFIG_ROWS: readonly ConfigRow[] = [
  { option: "environment", description: 'Groups data by deploy target, e.g. "production".' },
  {
    option: "release",
    description:
      "Your app's version or commit SHA. Tag it as a release to see stats scoped to that deploy.",
  },
  { option: "sampleRate", description: "Fraction of sessions to monitor, 0–1. Default: 1." },
  {
    option: "integrations",
    description:
      "Toggle individual capture sources: errors, fetch, xhr, webVitals, navigation, performance.",
  },
  {
    option: "ignoreErrors / ignoreUrls",
    description: "Substrings or regular expressions to drop before an event is queued.",
  },
  { option: "tags", description: "Static key/value pairs attached to every event." },
  {
    option: "privacy.captureUserContext",
    description: "Opt in to a random, non-personal id for counting affected users. Default: false.",
  },
  {
    option: "beforeSend",
    description: "Inspect, redact, or drop (return null) any event before it leaves the browser.",
  },
]

export default function GuidePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-16 pb-8 lg:px-6">
          <p className="text-sm font-medium text-muted-foreground">Guide</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Set up TraceForge in your app
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">
            Everything from your first <code className="font-mono text-sm">init()</code> call to
            server-side error capture, alerts and release tracking. See the{" "}
            <Link href="/#features" className="underline underline-offset-4 hover:text-foreground">
              feature overview
            </Link>{" "}
            for what TraceForge captures and why.
          </p>
          <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-2">
            {CONTENTS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </section>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-4 pt-8 pb-24 lg:px-6">
          <section id="install" aria-labelledby="install-title" className="scroll-mt-20">
            <h2 id="install-title" className="text-2xl font-semibold tracking-tight">
              Install &amp; initialize
            </h2>
            <p className="mt-3 text-muted-foreground">
              One package, zero runtime dependencies. Create a project in the dashboard to get a DSN
              — it can only send events, so it&apos;s safe to ship in frontend code.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <CodeBlock code="npm install @traceforge/sdk" label="Terminal" />
              <CodeBlock code={INIT_CODE} label="instrumentation-client.ts" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              In Next.js, initialize inside{" "}
              <code className="font-mono">instrumentation-client.ts</code> so monitoring starts
              before hydration. For any other app, call <code className="font-mono">init()</code> as
              early as possible in your entry point.
            </p>
          </section>

          <section id="react" aria-labelledby="react-title" className="scroll-mt-20">
            <h2 id="react-title" className="text-2xl font-semibold tracking-tight">
              React error boundary
            </h2>
            <p className="mt-3 text-muted-foreground">
              <code className="font-mono">@traceforge/sdk/react</code> catches render errors that
              never reach <code className="font-mono">window.onerror</code>.{" "}
              <code className="font-mono">react</code> is an optional peer dependency — nothing here
              is pulled into the core bundle if you don&apos;t import it.
            </p>
            <div className="mt-6">
              <CodeBlock code={REACT_CODE} label="App.tsx" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Reports with <code className="font-mono">mechanism: &quot;error-boundary&quot;</code>{" "}
              and the React component stack. <code className="font-mono">fallback</code> can also be
              a function of <code className="font-mono">(error, reset)</code>, and{" "}
              <code className="font-mono">onError(error, componentStack)</code> fires alongside the
              report for your own handling — a toast, for example.
            </p>
          </section>

          <section id="nextjs" aria-labelledby="nextjs-title" className="scroll-mt-20">
            <h2 id="nextjs-title" className="text-2xl font-semibold tracking-tight">
              Next.js server-side errors
            </h2>
            <p className="mt-3 text-muted-foreground">
              <code className="font-mono">@traceforge/sdk/next</code> reports crashes in Server
              Components, Route Handlers and Server Actions — errors the browser SDK never sees.
              It&apos;s server-only and adds nothing to the browser bundle.
            </p>
            <div className="mt-6">
              <CodeBlock code={NEXT_CODE} label="instrumentation.ts" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Reports with <code className="font-mono">mechanism: &quot;server&quot;</code> and the
              route template Next.js provides (e.g. <code className="font-mono">/orders/[id]</code>
              ), reusing the same issue grouping, alerts and resolution workflow as browser errors.
            </p>
          </section>

          <section
            id="configuration"
            aria-labelledby="configuration-title"
            className="scroll-mt-20"
          >
            <h2 id="configuration-title" className="text-2xl font-semibold tracking-tight">
              Configuration
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every option is optional beyond <code className="font-mono">dsn</code>. Sensible
              defaults favor privacy and low overhead.
            </p>
            <div className="mt-6">
              <CodeBlock code={CONFIG_CODE} label="instrumentation-client.ts" />
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Option
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      What it does
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {CONFIG_ROWS.map((row) => (
                    <tr key={row.option}>
                      <td className="px-4 py-3 align-top font-mono text-xs whitespace-nowrap">
                        {row.option}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="alerts" aria-labelledby="alerts-title" className="scroll-mt-20">
            <h2 id="alerts-title" className="text-2xl font-semibold tracking-tight">
              Alerts &amp; webhooks
            </h2>
            <p className="mt-3 text-muted-foreground">
              Get notified the moment something breaks, without watching a dashboard. Open a
              project&apos;s <strong>Settings → Alerts</strong>, add a webhook URL — a Slack
              incoming webhook or any HTTPS endpoint — and choose what should trigger it: new
              issues, regressions (a resolved issue coming back), or both. TraceForge sends a test
              payload on save so you can confirm delivery before relying on it.
            </p>
          </section>

          <section id="releases" aria-labelledby="releases-title" className="scroll-mt-20">
            <h2 id="releases-title" className="text-2xl font-semibold tracking-tight">
              Releases
            </h2>
            <p className="mt-3 text-muted-foreground">
              Pass a <code className="font-mono">release</code> (your git SHA or a semver string) to{" "}
              <code className="font-mono">init()</code> or{" "}
              <code className="font-mono">withTraceForge()</code>, then tag the same string under{" "}
              <strong>Releases</strong> in the dashboard. The release page shows events, issues and
              affected users scoped to that exact deploy — useful for confirming a fix actually
              shipped, or spotting a regression right after a release goes out.
            </p>
          </section>

          <section id="self-hosting" aria-labelledby="self-hosting-title" className="scroll-mt-20">
            <h2 id="self-hosting-title" className="text-2xl font-semibold tracking-tight">
              Self-hosting
            </h2>
            <p className="mt-3 text-muted-foreground">
              TraceForge is MIT licensed and designed to run on free tiers: the dashboard and demo
              on Vercel, the API on Render, Postgres on Neon. The full walkthrough, including
              environment variables and troubleshooting, is in{" "}
              <a
                href={`${GITHUB_URL}/blob/main/docs/DEPLOY.md`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                docs/DEPLOY.md
              </a>{" "}
              on GitHub.
            </p>
          </section>

          <Card className="bg-muted/40">
            <CardContent className="flex flex-col items-start gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Ready to try it?</h2>
              <p className="text-sm text-muted-foreground">
                Create a project and paste one line into your app — real sessions show up within
                minutes.
              </p>
              <Link
                href="/signup"
                className="text-sm font-medium underline underline-offset-4 hover:no-underline"
              >
                Get started free →
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
