"use client"

import type { Project } from "@traceforge/event-schema"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import { Spinner } from "@traceforge/ui/components/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@traceforge/ui/components/tabs"
import { CircleCheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { CodeBlock } from "@/components/code-block"
import { useEventStream } from "@/components/live/use-event-stream"

const nextSnippet = (
  dsn: string
) => `// instrumentation-client.ts (project root). Runs before your app hydrates.
import { init } from "@traceforge/sdk"

init({
  dsn: "${dsn}",
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
})`

const reactSnippet = (dsn: string) => `// main.tsx, before createRoot()
import { init } from "@traceforge/sdk"

init({
  dsn: "${dsn}",
  environment: "production",
})`

const scriptSnippet = (
  dsn: string
) => `<script src="https://cdn.jsdelivr.net/npm/@traceforge/sdk/dist/traceforge.iife.js"></script>
<script>
  TraceForge.init({ dsn: "${dsn}", environment: "production" })
</script>`

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-2">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums"
      >
        {n}
      </span>
      <h3 className="self-center text-sm font-medium">{title}</h3>
      <div className="col-start-2 flex min-w-0 flex-col gap-2">{children}</div>
    </li>
  )
}

/** Shown until the first event arrives; flips to the dashboard by itself. */
export function Onboarding({ project }: { project: Project }) {
  const router = useRouter()
  const [received, setReceived] = useState(false)
  useEventStream(project.id, () => {
    if (received) return
    setReceived(true)
    setTimeout(() => router.refresh(), 1_200)
  })

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-lg">Connect {project.name}</CardTitle>
        <CardDescription>
          Three steps. The dashboard updates as soon as your first event arrives.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Install the SDK">
            <CodeBlock code="npm install @traceforge/sdk" label="Terminal" />
          </Step>
          <Step n={2} title="Initialize it with your DSN">
            <Tabs defaultValue={project.platform === "javascript" ? "script" : project.platform}>
              <TabsList>
                <TabsTrigger value="nextjs">Next.js</TabsTrigger>
                <TabsTrigger value="react">React</TabsTrigger>
                <TabsTrigger value="script">Script tag</TabsTrigger>
              </TabsList>
              <TabsContent value="nextjs">
                <CodeBlock code={nextSnippet(project.dsn)} label="instrumentation-client.ts" />
              </TabsContent>
              <TabsContent value="react">
                <CodeBlock code={reactSnippet(project.dsn)} label="main.tsx" />
              </TabsContent>
              <TabsContent value="script">
                <CodeBlock code={scriptSnippet(project.dsn)} label="index.html" />
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              The DSN only allows sending events, so it is safe to ship in your frontend bundle.
            </p>
          </Step>
          <Step n={3} title="Send your first event">
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm"
            >
              {received ? (
                <>
                  <CircleCheckIcon className="size-4 text-status-good-text" />
                  First event received. Loading your dashboard…
                </>
              ) : (
                <>
                  <Spinner className="text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Waiting for your first event. Load any page of your app.
                  </span>
                </>
              )}
            </div>
          </Step>
        </ol>
      </CardContent>
    </Card>
  )
}
