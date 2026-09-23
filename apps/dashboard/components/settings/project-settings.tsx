"use client"

import { PLATFORMS, type Platform, type Project } from "@traceforge/event-schema"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@traceforge/ui/components/field"
import { Input } from "@traceforge/ui/components/input"
import { Spinner } from "@traceforge/ui/components/spinner"
import { Textarea } from "@traceforge/ui/components/textarea"
import { ToggleGroup, ToggleGroupItem } from "@traceforge/ui/components/toggle-group"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { CodeBlock } from "@/components/code-block"
import { PLATFORM_LABELS } from "@/components/projects/platforms"

import { useProjectMutation } from "./use-project-mutation"

function GeneralSection({ project }: { project: Project }) {
  const { mutate, pending, toast } = useProjectMutation(project.id)
  const [name, setName] = useState(project.name)
  const [platform, setPlatform] = useState<Platform>(project.platform)
  const [error, setError] = useState<string | null>(null)
  const dirty = name.trim() !== project.name || platform !== project.platform

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError("Give the project a name.")
    setError(null)
    const result = await mutate("PATCH", "", { name: name.trim(), platform })
    if (result.ok) toast.success("Project updated")
    else toast.error(result.message)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>How this project appears in TraceForge.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="general" onSubmit={save} noValidate>
          <FieldGroup>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                value={name}
                maxLength={64}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!error || undefined}
                disabled={pending}
              />
              <FieldError>{error}</FieldError>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Platform</FieldLegend>
              <ToggleGroup
                variant="outline"
                aria-label="Platform"
                value={[platform]}
                onValueChange={(value) => value[0] && setPlatform(value[0] as Platform)}
                disabled={pending}
              >
                {PLATFORMS.map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {PLATFORM_LABELS[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button type="submit" form="general" disabled={!dirty || pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  )
}

function KeysSection({ project }: { project: Project }) {
  const { mutate, pending, toast } = useProjectMutation(project.id)
  const [open, setOpen] = useState(false)

  async function rotate() {
    const result = await mutate("POST", "/rotate-key")
    setOpen(false)
    if (result.ok) toast.success("Key rotated. Update the DSN in your app.")
    else toast.error(result.message)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DSN and ingestion key</CardTitle>
        <CardDescription>
          Paste the DSN into <code className="font-mono text-xs">init()</code>. It can only send
          events, never read them, so it is safe in frontend code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CodeBlock code={project.dsn} label="DSN" />
      </CardContent>
      <CardFooter className="justify-between gap-4 border-t">
        <p className="text-sm text-muted-foreground">Rotate if the key is being abused.</p>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger render={<Button variant="outline" />}>Rotate key</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rotate the ingestion key?</AlertDialogTitle>
              <AlertDialogDescription>
                The current key stops working immediately. Apps using the old DSN will stop sending
                events until you deploy the new one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={rotate} disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                Rotate key
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}

const ORIGIN = /^https?:\/\/[^/\s]+$/

function IngestionSection({ project }: { project: Project }) {
  const { mutate, pending, toast } = useProjectMutation(project.id)
  const [origins, setOrigins] = useState(project.allowedOrigins.join("\n"))
  const [error, setError] = useState<string | null>(null)
  const list = origins
    .split(/\s+/)
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean)
  const dirty = list.join("\n") !== project.allowedOrigins.join("\n")

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const invalid = list.find((origin) => !ORIGIN.test(origin))
    if (invalid)
      return setError(`"${invalid}" is not an origin. Use the form https://app.example.com.`)
    setError(null)
    const result = await mutate("PATCH", "", { allowedOrigins: list })
    if (result.ok) toast.success("Allowed origins saved")
    else toast.error(result.message)
  }

  async function toggleStatus() {
    const next = project.status === "active" ? "paused" : "active"
    const result = await mutate("PATCH", "", { status: next })
    if (result.ok) toast.success(next === "paused" ? "Ingestion paused" : "Ingestion resumed")
    else toast.error(result.message)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingestion</CardTitle>
        <CardDescription>Control who can send events to this project.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="origins" onSubmit={save} noValidate>
          <FieldGroup>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="origins-input">Allowed origins</FieldLabel>
              <Textarea
                id="origins-input"
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                placeholder={"https://shop.example.com\nhttps://staging.shop.example.com"}
                rows={4}
                className="font-mono text-xs"
                aria-invalid={!!error || undefined}
                disabled={pending}
              />
              <FieldDescription>
                One per line. Leave empty to accept events from any origin.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-between gap-4 border-t">
        <Button variant="outline" onClick={toggleStatus} disabled={pending}>
          {project.status === "active" ? "Pause ingestion" : "Resume ingestion"}
        </Button>
        <Button type="submit" form="origins" disabled={!dirty || pending}>
          Save origins
        </Button>
      </CardFooter>
    </Card>
  )
}

function DangerSection({ project }: { project: Project }) {
  const router = useRouter()
  const { mutate, pending, toast } = useProjectMutation(project.id)
  const [confirm, setConfirm] = useState("")

  async function remove() {
    const result = await mutate("DELETE")
    if (!result.ok) return toast.error(result.message)
    toast.success(`Deleted ${project.name}`)
    router.replace("/projects")
  }

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle>Delete project</CardTitle>
        <CardDescription>
          Permanently deletes the project and all of its events, issues and metrics.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end border-t">
        <AlertDialog onOpenChange={() => setConfirm("")}>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            Delete project
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This can&apos;t be undone. Type the project name to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              aria-label="Project name"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={project.name}
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={remove}
                disabled={confirm !== project.name || pending}
              >
                {pending && <Spinner data-icon="inline-start" />}
                Delete forever
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}

export function ProjectSettings({ project }: { project: Project }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <GeneralSection project={project} />
      <KeysSection project={project} />
      <IngestionSection project={project} />
      <DangerSection project={project} />
    </div>
  )
}
