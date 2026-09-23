import { cn } from "@pulseed/ui/lib/utils"

import { CopyButton } from "./copy-button"

/** Read-only code with a copy button. Content is rendered as text, never HTML. */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string
  label?: string
  className?: string
}) {
  return (
    <div className={cn("relative rounded-lg border bg-muted/50", className)}>
      {label && (
        <div className="flex h-9 items-center border-b px-3 font-mono text-xs text-muted-foreground">
          {label}
        </div>
      )}
      <div className="absolute top-1 right-1">
        <CopyButton value={code} label={`Copy ${label ?? "code"}`} />
      </div>
      <pre className="overflow-x-auto p-3 pr-10 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}
