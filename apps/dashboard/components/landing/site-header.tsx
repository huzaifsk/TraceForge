import { Button } from "@pulseed/ui/components/button"
import Link from "next/link"

import { Logo } from "@/components/logo"

export const GITHUB_URL = "https://github.com/huzaifsk/Pulseed"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 lg:px-6">
        <Link
          href="/"
          aria-label="Pulseed home"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <nav
          aria-label="Site"
          className="hidden items-center gap-5 text-sm text-muted-foreground md:flex"
        >
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <a href="#privacy" className="hover:text-foreground">
            Privacy
          </a>
          <a href={GITHUB_URL} className="hover:text-foreground">
            GitHub
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
            Get started
          </Button>
        </div>
      </div>
    </header>
  )
}
