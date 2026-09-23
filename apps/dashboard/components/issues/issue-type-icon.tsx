import { cn } from "@traceforge/ui/lib/utils"
import { BugIcon, CircleSlashIcon, NetworkIcon } from "lucide-react"

const TYPES = {
  error: { icon: BugIcon, label: "Error" },
  unhandled_rejection: { icon: CircleSlashIcon, label: "Unhandled rejection" },
  api_error: { icon: NetworkIcon, label: "API error" },
} as const

export function issueTypeLabel(type: string) {
  return TYPES[type as keyof typeof TYPES]?.label ?? "Issue"
}

export function IssueTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPES[type as keyof typeof TYPES]?.icon ?? BugIcon
  return (
    <Icon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground", className)} />
  )
}
