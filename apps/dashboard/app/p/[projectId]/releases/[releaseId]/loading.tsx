import { Skeleton } from "@traceforge/ui/components/skeleton"

import { TileSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading release"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-40" />
      </div>
      <TileSkeleton />
    </div>
  )
}
