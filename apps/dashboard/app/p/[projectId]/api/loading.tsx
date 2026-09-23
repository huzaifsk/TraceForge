import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading API performance"
    >
      <HeaderSkeleton />
      <TableSkeleton />
    </div>
  )
}
