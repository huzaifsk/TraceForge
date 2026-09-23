"use client"

import { Button } from "@pulseed/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@pulseed/ui/components/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@pulseed/ui/components/field"
import { Input } from "@pulseed/ui/components/input"
import { Spinner } from "@pulseed/ui/components/spinner"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

type Mode = "login" | "signup"

const COPY: Record<Mode, { title: string; description: string; submit: string }> = {
  login: {
    title: "Sign in",
    description: "Welcome back. Sign in to see what your users are running into.",
    submit: "Sign in",
  },
  signup: {
    title: "Create your account",
    description: "Monitor errors, API failures and Web Vitals from real users.",
    submit: "Create account",
  },
}

const MIN_PASSWORD = 10

/** Only same-app paths are allowed as a post-login destination (no open redirects). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/projects"
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const copy = COPY[mode]

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")
    const name = String(form.get("name") ?? "").trim()

    const errors: Record<string, string> = {}
    if (mode === "signup" && !name) errors.name = "Enter your name."
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address."
    if (password.length < (mode === "signup" ? MIN_PASSWORD : 1)) {
      errors.password =
        mode === "signup" ? `Use at least ${MIN_PASSWORD} characters.` : "Enter your password."
    }
    setFieldErrors(errors)
    setError(null)
    if (Object.keys(errors).length > 0) return

    setPending(true)
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "sign-in" : "sign-up"}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, name }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        setError(
          response.status === 401
            ? "That email and password don't match."
            : response.status === 429
              ? "Too many attempts. Wait a minute and try again."
              : (body?.message ?? "Something went wrong. Please try again.")
        )
        return
      }
      router.replace(safeNext(searchParams.get("next")))
      router.refresh()
    } catch {
      setError("Can't reach Pulseed. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="auth-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {mode === "signup" && (
              <Field data-invalid={!!fieldErrors.name || undefined}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  aria-invalid={!!fieldErrors.name || undefined}
                  disabled={pending}
                />
                <FieldError>{fieldErrors.name}</FieldError>
              </Field>
            )}
            <Field data-invalid={!!fieldErrors.email || undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={!!fieldErrors.email || undefined}
                disabled={pending}
              />
              <FieldError>{fieldErrors.email}</FieldError>
            </Field>
            <Field data-invalid={!!fieldErrors.password || undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                aria-invalid={!!fieldErrors.password || undefined}
                disabled={pending}
              />
              <FieldError>{fieldErrors.password}</FieldError>
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button type="submit" form="auth-form" className="w-full" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {copy.submit}
        </Button>
        <p className="text-sm text-muted-foreground">
          {mode === "login" ? "New to Pulseed? " : "Already have an account? "}
          <Link
            href={mode === "login" ? "/signup" : "/login"}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
