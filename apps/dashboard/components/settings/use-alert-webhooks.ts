"use client"

import { alertWebhookSchema, type AlertWebhook } from "@traceforge/event-schema"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type Result = { ok: true; webhook: AlertWebhook | null } | { ok: false; message: string }

/** POST/PATCH/DELETE against a project's alert webhooks, with a toast and a server refresh. */
export function useAlertWebhooks(projectId: string) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const base = `/api/v1/projects/${projectId}/alert-webhooks`

  async function mutate(
    method: "POST" | "PATCH" | "DELETE",
    path = "",
    body?: unknown
  ): Promise<Result> {
    setPending(true)
    try {
      const response = await fetch(`${base}${path}`, {
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
      const webhook =
        response.status === 204 ? null : alertWebhookSchema.parse(await response.json())
      router.refresh()
      return { ok: true, webhook }
    } catch {
      return { ok: false, message: "Can't reach TraceForge. Check your connection." }
    } finally {
      setPending(false)
    }
  }

  async function sendTest(id: string): Promise<{ ok: boolean; message?: string }> {
    setPending(true)
    try {
      const response = await fetch(`${base}/${id}/test`, { method: "POST" })
      if (response.ok) return { ok: true }
      const error = (await response.json().catch(() => null)) as { message?: string } | null
      return { ok: false, message: error?.message ?? "Delivery failed." }
    } catch {
      return { ok: false, message: "Can't reach TraceForge. Check your connection." }
    } finally {
      setPending(false)
    }
  }

  return { mutate, sendTest, pending, toast }
}
