import { Skeleton } from "@pulseed/ui/components/skeleton"

import { ChartCardSkeleton, TileSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading issue">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <TileSkeleton />
      <ChartCardSkeleton />
    </div>
  )
}
