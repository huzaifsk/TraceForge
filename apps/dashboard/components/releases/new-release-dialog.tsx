"use client"

import { Button } from "@traceforge/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@traceforge/ui/components/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@traceforge/ui/components/field"
import { Input } from "@traceforge/ui/components/input"
import { Spinner } from "@traceforge/ui/components/spinner"
import { Textarea } from "@traceforge/ui/components/textarea"
import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export function NewReleaseDialog({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [version, setVersion] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!version.trim()) return setError("Give the release a version.")
    setError(null)
    setPending(true)
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/releases`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: version.trim(), notes: notes.trim() || undefined }),
      })
      if (response.status === 401) return router.replace("/login")
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        setError(body?.message ?? "Something went wrong.")
        return
      }
      setOpen(false)
      setVersion("")
      setNotes("")
      toast.success("Release tagged")
      router.refresh()
    } catch {
      setError("Can't reach TraceForge. Check your connection.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        New release
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag a release</DialogTitle>
          <DialogDescription>
            Marks a version so its issues and events can be reviewed together.
          </DialogDescription>
        </DialogHeader>
        <form id="new-release" onSubmit={save} noValidate>
          <FieldGroup>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="release-version">Version</FieldLabel>
              <Input
                id="release-version"
                value={version}
                maxLength={128}
                placeholder="v1.2.3 or a commit SHA"
                onChange={(e) => setVersion(e.target.value)}
                aria-invalid={!!error || undefined}
                disabled={pending}
                autoFocus
              />
              <FieldError>{error}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="release-notes">Notes (optional)</FieldLabel>
              <Textarea
                id="release-notes"
                value={notes}
                maxLength={2_000}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
              />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="new-release" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Tag release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
