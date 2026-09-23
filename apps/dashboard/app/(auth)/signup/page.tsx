import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthForm } from "@/components/auth/auth-form"
import { getSessionUser } from "@/lib/api"

export const metadata: Metadata = { title: "Create account" }

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/projects")
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  )
}
