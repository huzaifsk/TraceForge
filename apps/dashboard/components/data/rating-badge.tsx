import type { WebVitalRating } from "@pulseed/event-schema/constants"
import { Badge } from "@pulseed/ui/components/badge"
import { cn } from "@pulseed/ui/lib/utils"
import { CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react"

const RATING = {
  good: { label: "Good", icon: CircleCheckIcon, className: "text-status-good-text" },
  "needs-improvement": {
    label: "Needs improvement",
    icon: CircleAlertIcon,
    className: "text-status-warning-text",
  },
  poor: { label: "Poor", icon: CircleXIcon, className: "text-status-critical-text" },
} as const

/** Status is never color-alone: icon + label, colored icon only. */
export function RatingBadge({
  rating,
  className,
}: {
  rating: WebVitalRating | null
  className?: string
}) {
  if (!rating) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        No data
      </Badge>
    )
  }
  const { label, icon: Icon, className: tone } = RATING[rating]
  return (
    <Badge variant="outline" className={className}>
      <Icon data-icon="inline-start" className={tone} />
      {label}
    </Badge>
  )
}
