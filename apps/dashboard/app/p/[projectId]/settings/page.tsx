import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { ProjectSettings } from "@/components/settings/project-settings"
import { getProject } from "@/lib/data"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage({ params }: PageProps<"/p/[projectId]/settings">) {
  const { projectId } = await params
  const project = await getProject(projectId)
  return (
    <>
      <PageHeader title="Settings" description={`Configuration for ${project.name}.`} />
      <ProjectSettings key={`${project.publicKey}-${project.name}`} project={project} />
    </>
  )
}
