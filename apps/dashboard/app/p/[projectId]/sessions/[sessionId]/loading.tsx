import { Skeleton } from "@traceforge/ui/components/skeleton"

import { TableSkeleton, TileSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading session"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-6 w-2/3" />
      </div>
      <TileSkeleton />
      <TableSkeleton />
    </div>
  )
}
