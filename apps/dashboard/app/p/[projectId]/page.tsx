import { redirect } from "next/navigation"

export default async function ProjectIndex({ params }: PageProps<"/p/[projectId]">) {
  const { projectId } = await params
  redirect(`/p/${projectId}/overview`)
}
