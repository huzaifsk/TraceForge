"use client"

import { PLATFORMS, type Platform, projectSchema } from "@traceforge/event-schema"
import { Button } from "@traceforge/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@traceforge/ui/components/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@traceforge/ui/components/field"
import { Input } from "@traceforge/ui/components/input"
import { Spinner } from "@traceforge/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@traceforge/ui/components/toggle-group"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { PLATFORM_LABELS } from "./platforms"

export function NewProjectForm() {
  const router = useRouter()
  const [platform, setPlatform] = useState<Platform>("nextjs")
  const [pending, setPending] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim()
    setError(null)
    if (!name) return setNameError("Give the project a name.")
    if (name.length > 64) return setNameError("Keep it under 64 characters.")
    setNameError(null)

    setPending(true)
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, platform }),
      })
      if (response.status === 401) return router.replace("/login")
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError((body as { message?: string } | null)?.message ?? "Couldn't create the project.")
        return
      }
      const project = projectSchema.parse(body)
      router.push(`/p/${project.id}/overview`)
      router.refresh()
    } catch {
      setError("Can't reach TraceForge. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">New project</CardTitle>
        <CardDescription>
          You&apos;ll get a DSN to paste into your app. It only allows sending events, never reading
          them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="new-project" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!nameError || undefined}>
              <FieldLabel htmlFor="name">Project name</FieldLabel>
              <Input
                id="name"
                name="name"
                placeholder="My e-commerce app"
                autoComplete="off"
                maxLength={64}
                aria-invalid={!!nameError || undefined}
                disabled={pending}
                autoFocus
              />
              <FieldError>{nameError}</FieldError>
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
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="new-project" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Create project
        </Button>
      </CardFooter>
    </Card>
  )
}
