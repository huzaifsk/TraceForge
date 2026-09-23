"use client"

import type { Project } from "@pulseed/event-schema"
import { SidebarInset, SidebarProvider } from "@pulseed/ui/components/sidebar"
import { useState } from "react"

import type { SessionUser } from "@/lib/api"

import { AppSidebar } from "./app-sidebar"
import { CommandMenu } from "./command-menu"
import { TopBar } from "./top-bar"

export function AppShell({
  projects,
  project,
  user,
  defaultOpen,
  children,
}: {
  projects: readonly Project[]
  project: Project
  user: SessionUser
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [commandOpen, setCommandOpen] = useState(false)
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar projects={projects} project={project} user={user} />
      <SidebarInset>
        <TopBar onOpenCommand={() => setCommandOpen(true)} />
        {/* SidebarInset already renders <main>; a second one would duplicate the landmark. */}
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">{children}</div>
      </SidebarInset>
      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        projects={projects}
        project={project}
      />
    </SidebarProvider>
  )
}
