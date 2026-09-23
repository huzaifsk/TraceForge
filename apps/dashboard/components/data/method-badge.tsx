import { Badge } from "@pulseed/ui/components/badge"

export function MethodBadge({ method }: { method: string }) {
  return (
    <Badge variant="outline" className="font-mono text-[0.7rem] tracking-wide">
      {method}
    </Badge>
  )
}
