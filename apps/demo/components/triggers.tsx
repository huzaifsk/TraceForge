"use client"

import { Badge } from "@traceforge/ui/components/badge"
import { Button } from "@traceforge/ui/components/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import {
  BugIcon,
  CircleSlashIcon,
  ComponentIcon,
  GaugeIcon,
  ImageIcon,
  LayoutPanelTopIcon,
  ServerCrashIcon,
  ServerIcon,
  TimerIcon,
  WifiOffIcon,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

interface Trigger {
  title: string
  description: string
  produces: string
  icon: React.ComponentType<{ className?: string }>
  action: string
  run?: () => void | Promise<void>
  href?: string
  note?: string
}

/** Block the main thread, as an expensive render would. */
function busyWait(ms: number) {
  const end = performance.now() + ms
  while (performance.now() < end) {
    // Intentionally spinning: this is the bug being demonstrated.
  }
}

const TRIGGERS: Trigger[] = [
  {
    title: "Trigger JS error",
    description: "Reads a property of undefined in an event handler: a real TypeError.",
    produces: "error",
    icon: BugIcon,
    action: "Throw",
    run: () => {
      // Thrown outside React's handler so it reaches window "error", like most real bugs.
      setTimeout(() => {
        const order = undefined as unknown as { items: string[] }
        order.items.map((item) => item.toUpperCase())
      })
    },
  },
  {
    title: "Unhandled rejection",
    description: "A payment promise rejects and nobody catches it.",
    produces: "unhandled_rejection",
    icon: CircleSlashIcon,
    action: "Reject",
    run: () => {
      void Promise.reject(new Error("Payment provider timeout after 10000ms"))
    },
  },
  {
    title: "Trigger API error",
    description: "Calls /api/demo/orders?fail=1, which answers 500.",
    produces: "api_error",
    icon: ServerCrashIcon,
    action: "Call API",
    run: async () => {
      const response = await fetch("/api/demo/orders?fail=1")
      toast.error(`GET /api/demo/orders → ${response.status}`)
    },
  },
  {
    title: "Slow API",
    description: "A request that succeeds, but only after 2.4 seconds.",
    produces: "api_request",
    icon: TimerIcon,
    action: "Call API",
    run: async () => {
      const started = performance.now()
      await fetch("/api/demo/slow?ms=2400")
      toast.success(`Answered after ${Math.round(performance.now() - started)} ms`)
    },
  },
  {
    title: "Network failure",
    description: "Fetches a host that doesn't exist, so the request never gets a response.",
    produces: "api_error",
    icon: WifiOffIcon,
    action: "Call API",
    run: async () => {
      try {
        await fetch("https://unreachable.invalid/api/health")
      } catch {
        toast.error("Network error: no response")
      }
    },
  },
  {
    title: "Slow render",
    description: "Blocks the main thread for 400 ms on click, which is a poor INP.",
    produces: "web_vital · INP",
    icon: GaugeIcon,
    action: "Click me",
    note: "INP is sent when you switch tabs or reload.",
    run: () => busyWait(400),
  },
  {
    title: "Large image",
    description: "Opens a page whose hero image arrives after 4.5 s: a poor LCP.",
    produces: "web_vital · LCP",
    icon: ImageIcon,
    action: "Open page",
    href: "/large-image",
    note: "LCP is sent when you leave the page.",
  },
  {
    title: "Layout shift",
    description: "Opens a page where a banner pushes the content down after 1 s.",
    produces: "web_vital · CLS",
    icon: LayoutPanelTopIcon,
    action: "Open page",
    href: "/layout-shift",
    note: "CLS is sent when you leave the page.",
  },
  {
    title: "React render crash",
    description: "A component throws while rendering; the error boundary catches it.",
    produces: "error · error-boundary",
    icon: ComponentIcon,
    action: "Open page",
    href: "/react-crash",
  },
  {
    title: "Server-side crash",
    description: "A Route Handler throws on the server — the browser SDK never sees this.",
    produces: "error · server",
    icon: ServerIcon,
    action: "Call API",
    run: async () => {
      const response = await fetch("/api/demo/server-crash")
      toast.error(`GET /api/demo/server-crash → ${response.status}`)
    },
  },
]

function TriggerCard({ trigger }: { trigger: Trigger }) {
  const [pending, setPending] = useState(false)
  const Icon = trigger.icon
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {trigger.title}
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="font-mono text-[0.7rem]">
            {trigger.produces}
          </Badge>
        </CardAction>
        <CardDescription>{trigger.description}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-between gap-3">
        <span className="text-xs text-muted-foreground">{trigger.note}</span>
        {trigger.href ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={trigger.href} />}
          >
            {trigger.action}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              try {
                await trigger.run?.()
              } finally {
                setPending(false)
              }
            }}
          >
            {trigger.action}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export function Triggers() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {TRIGGERS.map((trigger) => (
        <TriggerCard key={trigger.title} trigger={trigger} />
      ))}
    </div>
  )
}
