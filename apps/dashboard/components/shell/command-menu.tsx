"use client"

import type { Project } from "@pulseed/event-schema"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@pulseed/ui/components/command"
import { CopyIcon, FolderIcon, MoonIcon, PlusIcon, SunIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect } from "react"
import { toast } from "sonner"

import { ALL_ITEMS } from "./nav"
import { useFilterHref } from "./use-filter-href"

/**
 * ⌘K. No open/close animation: it is used many times a day. No separators
 * between groups: cmdk renders them as role="separator" inside the listbox,
 * which ARIA does not allow; the group headings already divide the list.
 */
export function CommandMenu({
  open,
  onOpenChange,
  projects,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: readonly Project[]
  project: Project
}) {
  const router = useRouter()
  const filterHref = useFilterHref()
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command menu"
      description="Jump to a page or run an action"
    >
      {/* The shadcn CommandDialog is only the dialog chrome; cmdk needs its own root. */}
      <Command>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Go to">
            {ALL_ITEMS.map(({ segment, label, icon: Icon }) => (
              <CommandItem
                key={segment}
                onSelect={() => run(() => router.push(filterHref(`/p/${project.id}/${segment}`)))}
              >
                <Icon />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
          {projects.length > 1 && (
            <>
              <CommandGroup heading="Switch project">
                {projects
                  .filter((item) => item.id !== project.id)
                  .map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`project ${item.name}`}
                      onSelect={() => run(() => router.push(`/p/${item.id}/overview`))}
                    >
                      <FolderIcon />
                      {item.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </>
          )}
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() =>
                run(() =>
                  navigator.clipboard.writeText(project.dsn).then(
                    () => toast.success("DSN copied"),
                    () => toast.error("Couldn't copy the DSN")
                  )
                )
              }
            >
              <CopyIcon />
              Copy project DSN
            </CommandItem>
            <CommandItem
              onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            >
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
              Toggle theme
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/projects/new"))}>
              <PlusIcon />
              New project
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
