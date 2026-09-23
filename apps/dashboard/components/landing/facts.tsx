const FACTS = [
  { value: "9 KB", label: "SDK, minified and compressed" },
  { value: "0", label: "runtime dependencies" },
  { value: "p75", label: "the Web Vitals standard percentile" },
  { value: "MIT", label: "open source, self-hostable" },
] as const

export function Facts() {
  return (
    <section
      aria-label="At a glance"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4"
    >
      {FACTS.map((fact) => (
        <div key={fact.label} className="flex flex-col gap-1 bg-background p-6">
          <span className="text-3xl font-semibold tracking-tight">{fact.value}</span>
          <span className="text-sm text-muted-foreground">{fact.label}</span>
        </div>
      ))}
    </section>
  )
}
