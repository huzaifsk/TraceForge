import Link from "next/link"

import { Logo } from "@/components/logo"

import { GITHUB_URL } from "./site-header"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <Logo className="text-foreground" />
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <a href={GITHUB_URL} className="hover:text-foreground">
            GitHub
          </a>
          <a href={`${GITHUB_URL}/blob/main/docs/DEPLOY.md`} className="hover:text-foreground">
            Self-host
          </a>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </nav>
        <p>Open source under the MIT license.</p>
      </div>
    </footer>
  )
}
