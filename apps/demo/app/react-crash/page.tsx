"use client"

import { Button } from "@traceforge/ui/components/button"
import Link from "next/link"
import { useState } from "react"

/** Throws during render, the only way an Error Boundary actually gets exercised. */
function Boom() {
  const order = undefined as unknown as { items: string[] }
  return <p>{order.items.length} items</p>
}

export default function ReactCrashPage() {
  const [crash, setCrash] = useState(false)

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <p className="text-sm text-muted-foreground">
        Clicking the button below mounts a component that throws while rendering — the kind of bug{" "}
        <code>window.onerror</code> never sees, only an Error Boundary does. Go{" "}
        <Link href="/" className="font-medium text-foreground underline underline-offset-4">
          back
        </Link>{" "}
        once it&apos;s caught.
      </p>
      <Button size="sm" variant="outline" className="w-fit" onClick={() => setCrash(true)}>
        Crash this component
      </Button>
      {crash && <Boom />}
    </main>
  )
}
