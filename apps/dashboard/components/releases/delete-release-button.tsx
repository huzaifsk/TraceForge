"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@traceforge/ui/components/alert-dialog"
import { Button } from "@traceforge/ui/components/button"
import { Spinner } from "@traceforge/ui/components/spinner"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export function DeleteReleaseButton({
  projectId,
  releaseId,
  version,
}: {
  projectId: string
  releaseId: string
  version: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function remove() {
    setPending(true)
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/releases/${releaseId}`, {
        method: "DELETE",
      })
      if (response.status === 401) return router.replace("/login")
      if (!response.ok) {
        toast.error("Couldn't delete this release.")
        return
      }
      toast.success(`Deleted ${version}`)
      router.push(`/p/${projectId}/releases`)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        <Trash2Icon data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {version}?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes this release marker only — events already tagged with it are untouched.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={remove} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
