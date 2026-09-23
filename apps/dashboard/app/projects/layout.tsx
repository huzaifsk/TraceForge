import Link from "next/link"

import { Logo } from "@/components/logo"
import { requireUser } from "@/lib/api"

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
        <Link
          href="/projects"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <span className="truncate text-sm text-muted-foreground">{user.email}</span>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 lg:p-6">
        {children}
      </main>
    </div>
  )
}
