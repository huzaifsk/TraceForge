"use client"

import type { MonitoringEvent } from "@traceforge/sdk"
import { Badge } from "@traceforge/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import { useEffect, useState } from "react"

function summarize(event: MonitoringEvent): string {
  switch (event.type) {
    case "error":
    case "unhandled_rejection":
      return `${event.payload.name}: ${event.payload.message}`
    case "api_error":
    case "api_request":
      return `${event.payload.method} ${event.payload.endpoint} → ${event.payload.status || "no response"}`
    case "web_vital":
      return `${event.payload.name} ${event.payload.name === "CLS" ? event.payload.value.toFixed(3) : `${Math.round(event.payload.value)} ms`} (${event.payload.rating})`
    case "navigation":
      return `${event.payload.from ?? "(entry)"} → ${event.payload.to}`
    case "performance":
      return `Page load ${event.payload.loadMs ?? "?"} ms`
  }
}

/** What this tab has captured, fed by the SDK's `beforeSend` hook. */
export function SessionLog() {
  const [events, setEvents] = useState<MonitoringEvent[]>([])
  useEffect(() => {
    const onCaptured = (e: Event) => {
      const event = (e as CustomEvent<MonitoringEvent>).detail
      setEvents((current) => [event, ...current].slice(0, 50))
    }
    window.addEventListener("traceforge:captured", onCaptured)
    return () => window.removeEventListener("traceforge:captured", onCaptured)
  }, [])

  return (
    <Card size="sm" className="lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle>Session log</CardTitle>
        <CardDescription>Events the SDK captured in this tab, sent in batches.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Click a trigger.</p>
        ) : (
          <ol className="flex flex-col gap-2" aria-live="polite">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-1 text-xs">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[0.65rem]">
                    {event.type}
                  </Badge>
                  <time className="text-muted-foreground tabular-nums">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </time>
                </span>
                <span className="break-words">{summarize(event)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
