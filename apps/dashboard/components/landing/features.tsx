import { Card, CardDescription, CardHeader, CardTitle } from "@pulseed/ui/components/card"
import {
  BugIcon,
  GaugeIcon,
  NetworkIcon,
  PackageIcon,
  RadioIcon,
  ShieldCheckIcon,
} from "lucide-react"

const FEATURES = [
  {
    icon: BugIcon,
    title: "Issues, not noise",
    description:
      "Identical errors group into one issue across deploys, with occurrences, affected users, the stack trace, and browser and page breakdowns.",
  },
  {
    icon: NetworkIcon,
    title: "API performance",
    description:
      "Every fetch your frontend makes, per endpoint: requests, error rate, average and p95 latency, status codes and recent failures.",
  },
  {
    icon: GaugeIcon,
    title: "Core Web Vitals",
    description:
      "LCP, INP, CLS, FCP and TTFB at p75 from real visits, rated against Google's thresholds, with the slowest routes called out.",
  },
  {
    icon: RadioIcon,
    title: "Live events",
    description:
      "Watch errors, requests and vitals stream in as they happen, and jump straight to the issue.",
  },
  {
    icon: PackageIcon,
    title: "A 9 KB SDK",
    description:
      "No dependencies. Batches, compresses and retries in the background, delivers when the tab closes, and never throws into your app.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Private by default",
    description:
      "Technical context only. No input values, cookies, headers or request bodies, and query strings are redacted in the browser.",
  },
] as const

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 id="features-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What failed, where, how often, and who it hit
        </h2>
        <p className="text-muted-foreground">
          Frontend bugs rarely reproduce on your machine. Pulseed shows you what real users ran
          into, grouped so you can fix the ones that matter first.
        </p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <li key={title}>
            <Card className="h-full">
              <CardHeader>
                <span className="mb-2 flex size-9 items-center justify-center rounded-lg border bg-muted/50">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="leading-relaxed">{description}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
