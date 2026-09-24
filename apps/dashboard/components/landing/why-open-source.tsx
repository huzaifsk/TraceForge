import { CheckIcon, XIcon } from "lucide-react"

const TRACEFORGE = [
  "MIT licensed — read every line, fork it, change it",
  "Self-host on your own infrastructure, or use the hosted instance",
  "Your events live in your Postgres database",
  "Free, with no per-event or per-seat pricing",
]

const TYPICAL = [
  "Closed source",
  "Hosted only, or self-hosting locked behind an enterprise plan",
  "Your data lives in the vendor's database",
  "Free tier caps events, then a paid plan",
]

function List({ items, kind }: { items: readonly string[]; kind: "yes" | "no" }) {
  const Icon = kind === "yes" ? CheckIcon : XIcon
  return (
    <ul className="flex flex-col gap-2.5 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Icon
            aria-hidden="true"
            className={`mt-0.5 size-4 shrink-0 ${kind === "yes" ? "text-status-good-text" : "text-muted-foreground"}`}
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

export function WhyOpenSource() {
  return (
    <section id="why-open-source" aria-labelledby="why-open-source-title" className="scroll-mt-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2
          id="why-open-source-title"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Why open source
        </h2>
        <p className="text-muted-foreground">
          Most frontend observability tools are closed-source SaaS with per-event pricing.
          TraceForge is code you can read, run anywhere, and never outgrow a free tier on.
        </p>
      </div>
      <div className="mt-10 grid gap-6 rounded-xl border p-6 md:grid-cols-2 md:p-8">
        <div className="flex flex-col gap-4">
          <h3 className="font-medium">TraceForge</h3>
          <List items={TRACEFORGE} kind="yes" />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="font-medium">A typical hosted tool</h3>
          <List items={TYPICAL} kind="no" />
        </div>
      </div>
    </section>
  )
}
