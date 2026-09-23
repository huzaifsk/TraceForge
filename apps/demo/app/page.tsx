import { SessionLog } from "@/components/session-log"
import { Triggers } from "@/components/triggers"

export default function DemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Break things on purpose</h1>
        <p className="text-sm text-muted-foreground">
          Every button causes a real failure. The Pulseed SDK catches it the same way it would in
          production, and it appears in the dashboard within seconds.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <Triggers />
        <SessionLog />
      </div>
    </main>
  )
}
