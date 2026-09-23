import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthForm } from "@/components/auth/auth-form"
import { getSessionUser } from "@/lib/api"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/projects")
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  )
}
