import { ChartCardSkeleton, HeaderSkeleton, TileSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading Web Vitals"
    >
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <TileSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton />
    </div>
  )
}
