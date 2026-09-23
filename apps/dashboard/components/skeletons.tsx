import { Card, CardContent, CardHeader } from "@pulseed/ui/components/card"
import { Skeleton } from "@pulseed/ui/components/skeleton"

/** Same geometry as the real header, so nothing shifts when data arrives. */
export function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-5 w-72 max-w-full" />
    </div>
  )
}

export function TileSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-36" />
      </CardContent>
    </Card>
  )
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Card className="gap-0 py-0">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="hidden h-6 w-24 md:block" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </Card>
  )
}
