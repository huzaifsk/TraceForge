import { Button } from "@pulseed/ui/components/button"
import { ExternalLinkIcon } from "lucide-react"
import Link from "next/link"

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"

export function DemoHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
      <nav aria-label="Demo pages" className="flex items-center gap-4 text-sm">
        <Link href="/" className="font-semibold tracking-tight">
          Acme Demo Shop
        </Link>
        <Link href="/orders" className="text-muted-foreground hover:text-foreground">
          Orders
        </Link>
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
      </nav>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<a href={DASHBOARD_URL} target="_blank" rel="noreferrer" />}
      >
        Open dashboard
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    </header>
  )
}
