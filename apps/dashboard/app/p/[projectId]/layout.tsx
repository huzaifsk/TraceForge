import { cookies } from "next/headers"

import { AppShell } from "@/components/shell/app-shell"
import { requireUser } from "@/lib/api"
import { getProject, getProjects } from "@/lib/data"

export default async function ProjectLayout({ children, params }: LayoutProps<"/p/[projectId]">) {
  const { projectId } = await params
  const user = await requireUser()
  const [projects, project] = await Promise.all([getProjects(), getProject(projectId)])
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <AppShell projects={projects} project={project} user={user} defaultOpen={defaultOpen}>
      {children}
    </AppShell>
  )
}
