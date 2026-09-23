import { CodeBlock } from "@/components/code-block"

const INIT = `// instrumentation-client.ts (Next.js) or main.tsx (React)
import { init } from "@traceforge/sdk"

init({
  dsn: process.env.NEXT_PUBLIC_TRACEFORGE_DSN!,
  environment: "production",
})`

const STEPS = [
  {
    title: "Install the SDK",
    body: "One package, no dependencies.",
    code: "npm install @traceforge/sdk",
    label: "Terminal",
  },
  {
    title: "Initialize it with your DSN",
    body: "Create a project to get a DSN. It can only send events, so it's safe in frontend code.",
    code: INIT,
    label: "instrumentation-client.ts",
  },
  {
    title: "Watch real sessions arrive",
    body: "Errors, failing and slow requests, and Web Vitals show up in the dashboard within seconds. Nothing else to wire up.",
  },
] as const

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 id="how-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Set up in two minutes
        </h2>
        <p className="text-muted-foreground">
          Works with Next.js, React, and any site that can load a script.
        </p>
      </div>
      <ol className="mt-10 grid gap-6 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex min-w-0 flex-col gap-3">
            <span
              className="flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className="font-medium">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.body}</p>
            {"code" in step && <CodeBlock code={step.code} label={step.label} />}
          </li>
        ))}
      </ol>
    </section>
  )
}
