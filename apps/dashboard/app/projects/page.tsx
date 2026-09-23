import { Badge } from "@pulseed/ui/components/badge"
import { Button } from "@pulseed/ui/components/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@pulseed/ui/components/card"
import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { RelativeTime } from "@/components/data/relative-time"
import { PageHeader } from "@/components/page-header"
import { PLATFORM_LABELS } from "@/components/projects/platforms"
import { getProjects } from "@/lib/data"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const projects = await getProjects()
  if (projects.length === 0) redirect("/projects/new")

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project has its own DSN, issues and performance data."
        actions={
          <Button nativeButton={false} render={<Link href="/projects/new" />}>
            <PlusIcon data-icon="inline-start" />
            New project
          </Button>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/p/${project.id}/overview`}
              className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{project.name}</span>
                    {project.status === "paused" && <Badge variant="secondary">Paused</Badge>}
                  </CardTitle>
                  <CardDescription className="flex flex-col gap-1">
                    <span>{PLATFORM_LABELS[project.platform]}</span>
                    <span className="text-xs">
                      {project.lastEventAt ? (
                        <>
                          Last event <RelativeTime date={project.lastEventAt} />
                        </>
                      ) : (
                        "Waiting for the first event"
                      )}
                    </span>
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
