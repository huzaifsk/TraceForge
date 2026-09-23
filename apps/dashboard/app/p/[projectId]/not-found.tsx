import { Button } from "@traceforge/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@traceforge/ui/components/empty"
import Link from "next/link"

export default function NotFound() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Not found</EmptyTitle>
        <EmptyDescription>It may have been deleted, or you may not have access.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link href="/projects" />}>
          Back to projects
        </Button>
      </EmptyContent>
    </Empty>
  )
}
