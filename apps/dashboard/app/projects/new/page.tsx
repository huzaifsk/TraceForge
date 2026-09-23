import type { Metadata } from "next"

import { NewProjectForm } from "@/components/projects/new-project-form"

export const metadata: Metadata = { title: "New project" }

export default function NewProjectPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-8">
      <NewProjectForm />
    </div>
  )
}
