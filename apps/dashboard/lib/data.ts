import "server-only"

import { projectSchema } from "@traceforge/event-schema"
import { notFound } from "next/navigation"
import { cache } from "react"
import { z } from "zod"

import { apiGet } from "./api"

/** One request per render for the project list, shared by layouts and pages. */
export const getProjects = cache(async () => {
  const { projects } = await apiGet(
    "/api/v1/projects",
    z.object({ projects: z.array(projectSchema) })
  )
  return projects
})

export const getProject = cache(async (projectId: string) => {
  const project = (await getProjects()).find((item) => item.id === projectId)
  if (!project) notFound()
  return project
})
