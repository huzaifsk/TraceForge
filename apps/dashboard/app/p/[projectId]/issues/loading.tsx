import { Skeleton } from "@traceforge/ui/components/skeleton"

import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading issues">
      <HeaderSkeleton />
      <Skeleton className="h-8 w-full max-w-sm" />
      <TableSkeleton />
    </div>
  )
}
