import { CheckIcon, XIcon } from "lucide-react"

const COLLECTED = [
  "Error name, message and stack trace",
  "Request method, redacted URL, status and duration",
  "Web Vitals and page-load timing",
  "Route changes (paths only)",
  "Browser, OS and device type, viewport, language",
  "A random per-tab session id",
]

const NEVER = [
  "Input values or form contents",
  "Passwords, cookies or Authorization headers",
  "Request or response bodies",
  "localStorage contents",
  "Query-string values (redacted in the browser)",
  "Any personal data, unless you opt in to an anonymous id",
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

export function Privacy() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 id="privacy-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Your users stay anonymous
        </h2>
        <p className="text-muted-foreground">
          TraceForge collects the technical context needed to debug, and nothing else. The defaults
          are the private ones.
        </p>
      </div>
      <div className="mt-10 grid gap-6 rounded-xl border p-6 md:grid-cols-2 md:p-8">
        <div className="flex flex-col gap-4">
          <h3 className="font-medium">Collected</h3>
          <List items={COLLECTED} kind="yes" />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="font-medium">Never collected</h3>
          <List items={NEVER} kind="no" />
        </div>
      </div>
    </section>
  )
}
