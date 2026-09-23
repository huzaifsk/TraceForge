"use client"

import { Kbd } from "@pulseed/ui/components/kbd"
import { Button } from "@pulseed/ui/components/button"
import { Separator } from "@pulseed/ui/components/separator"
import { SidebarTrigger } from "@pulseed/ui/components/sidebar"
import { SearchIcon } from "lucide-react"
import { useSelectedLayoutSegment } from "next/navigation"

import { GlobalFilters } from "./filters"
import { titleFor } from "./nav"

/** Pages without time-based data don't show the global filters. */
const NO_FILTERS = new Set(["settings", "live"])

export function TopBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const segment = useSelectedLayoutSegment() ?? "overview"
  const showFilters = !NO_FILTERS.has(segment)
  return (
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 data-vertical:h-4" />
        <span className="truncate text-sm font-medium">{titleFor(segment)}</span>
        <div className="ml-auto flex items-center gap-2">
          {showFilters && (
            <div className="hidden md:block">
              <GlobalFilters />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCommand}
            className="text-muted-foreground"
          >
            <SearchIcon data-icon="inline-start" />
            <span className="hidden lg:inline">Search</span>
            <Kbd className="hidden lg:inline-flex">⌘K</Kbd>
          </Button>
        </div>
      </header>
      {showFilters && (
        /* Phones: the filters get their own scrollable row instead of disappearing. */
        <div className="-mt-1 overflow-x-auto px-4 pb-2 md:hidden">
          <GlobalFilters />
        </div>
      )}
    </div>
  )
}
