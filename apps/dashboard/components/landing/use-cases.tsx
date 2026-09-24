import { Card, CardDescription, CardHeader, CardTitle } from "@traceforge/ui/components/card"
import { CompassIcon, RocketIcon, SearchIcon } from "lucide-react"

const CASES = [
  {
    icon: RocketIcon,
    title: "Something broke after a deploy",
    scenario: "You just shipped.",
    description:
      "Tag the release, and its events, issues and affected users show up on their own page. If error volume spikes right after, you'll know before support tickets pile up — and a webhook can tell you the moment it happens.",
  },
  {
    icon: SearchIcon,
    title: "A user reports a bug you can't reproduce",
    scenario: "It works on your machine.",
    description:
      "Open the issue and see the exact stack trace, browser, OS, device and page it happened on — plus how many other users hit the same one, grouped by fingerprint across every deploy.",
  },
  {
    icon: CompassIcon,
    title: "Is the app getting slower?",
    scenario: "No one's complained yet.",
    description:
      "LCP, INP and CLS at p75, by route, from real visits — not a lab test. Catch a regression while it's a chart, not a support queue.",
  },
] as const

export function UseCases() {
  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className="scroll-mt-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 id="use-cases-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Three moments TraceForge is built for
        </h2>
        <p className="text-muted-foreground">
          Not another chart to check — the thing you reach for when something&apos;s actually wrong.
        </p>
      </div>
      <ul className="mt-10 grid gap-4 lg:grid-cols-3">
        {CASES.map(({ icon: Icon, title, scenario, description }) => (
          <li key={title}>
            <Card className="h-full">
              <CardHeader>
                <span className="mb-2 flex size-9 items-center justify-center rounded-lg border bg-muted/50">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <p className="text-xs font-medium text-muted-foreground">{scenario}</p>
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
