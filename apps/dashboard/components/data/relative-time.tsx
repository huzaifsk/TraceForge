"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@pulseed/ui/components/tooltip"
import { useSyncExternalStore } from "react"

import { formatDateTime, formatRelative } from "@/lib/format"

/** One shared minute clock for every relative timestamp on the page. */
let now = Date.now()
function subscribe(onTick: () => void) {
  now = Date.now()
  const timer = setInterval(() => {
    now = Date.now()
    onTick()
  }, 60_000)
  return () => clearInterval(timer)
}
const getSnapshot = () => now
/** The server renders absolute times; relative ones need the viewer's clock. */
const getServerSnapshot = () => null

/** "3m ago", with the absolute local time on hover. */
export function RelativeTime({ date }: { date: string | number }) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const iso = new Date(date).toISOString()
  return (
    <Tooltip>
      <TooltipTrigger render={<time dateTime={iso} className="whitespace-nowrap tabular-nums" />}>
        {current === null ? formatDateTime(date) : formatRelative(date, current)}
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(date)}</TooltipContent>
    </Tooltip>
  )
}
