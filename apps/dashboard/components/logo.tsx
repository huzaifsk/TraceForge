import { cn } from "@traceforge/ui/lib/utils"

/** TraceForge mark: a heartbeat trace inside a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6 shrink-0 text-primary", className)}
    >
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path
        d="M4.5 12.5h3.2l1.8-4.5 3 9 2.2-6 1.3 1.5h3.5"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn("flex items-center gap-2 text-base font-semibold tracking-tight", className)}
    >
      <LogoMark />
      TraceForge
    </span>
  )
}
