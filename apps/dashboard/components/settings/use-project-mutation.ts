"use client"

import { projectSchema, type Project } from "@pulseed/event-schema"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

/** PATCH/POST/DELETE against the project, with a toast and a server refresh. */
export function useProjectMutation(projectId: string) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function mutate(
    method: "PATCH" | "POST" | "DELETE",
    path = "",
    body?: unknown
  ): Promise<{ ok: true; project: Project | null } | { ok: false; message: string }> {
    setPending(true)
    try {
      const response = await fetch(`/api/v1/projects/${projectId}${path}`, {
        method,
        ...(body !== undefined && {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      })
      if (response.status === 401) {
        router.replace("/login")
        return { ok: false, message: "Your session expired." }
      }
      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { message?: string } | null
        return { ok: false, message: error?.message ?? "Something went wrong." }
      }
      const project = response.status === 204 ? null : projectSchema.parse(await response.json())
      router.refresh()
      return { ok: true, project }
    } catch {
      return { ok: false, message: "Can't reach Pulseed. Check your connection." }
    } finally {
      setPending(false)
    }
  }

  return { mutate, pending, toast }
}
