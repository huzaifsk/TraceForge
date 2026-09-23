"use client"

import type { IssueStatus } from "@pulseed/event-schema"
import { Button } from "@pulseed/ui/components/button"
import { ButtonGroup } from "@pulseed/ui/components/button-group"
import { CircleCheckIcon, EyeOffIcon, RotateCcwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

/** Resolve / ignore / reopen, applied optimistically and rolled back if the API refuses. */
export function IssueActions({
  projectId,
  issueId,
  status,
}: {
  projectId: string
  issueId: string
  status: IssueStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(status)

  const update = (next: IssueStatus, message: string) =>
    startTransition(async () => {
      setOptimistic(next)
      const response = await fetch(`/api/v1/projects/${projectId}/issues/${issueId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      }).catch(() => null)
      if (!response?.ok) {
        toast.error("Couldn't update the issue. Try again.")
        return
      }
      toast.success(message)
      router.refresh()
    })

  if (optimistic !== "unresolved") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => update("unresolved", "Issue reopened")}
      >
        <RotateCcwIcon data-icon="inline-start" />
        Reopen
      </Button>
    )
  }
  return (
    <ButtonGroup>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => update("resolved", "Issue resolved")}
      >
        <CircleCheckIcon data-icon="inline-start" />
        Resolve
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => update("ignored", "Issue ignored")}
      >
        <EyeOffIcon data-icon="inline-start" />
        Ignore
      </Button>
    </ButtonGroup>
  )
}
