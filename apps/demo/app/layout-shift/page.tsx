import Link from "next/link"

import { LateBanner } from "@/components/late-banner"

export default function LayoutShiftPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <LateBanner />
      <div
        aria-hidden="true"
        className="flex h-[55vh] items-end rounded-xl border bg-muted p-6 text-sm text-muted-foreground"
      >
        Featured product
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Spring collection</h1>
      {Array.from({ length: 6 }, (_, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          This text moved when the banner appeared. That movement is Cumulative Layout Shift, and it
          is what makes people tap the wrong button.
        </p>
      ))}
      <Link href="/" className="text-sm font-medium underline underline-offset-4">
        Back to the triggers
      </Link>
    </main>
  )
}
