"use client"

import { ISSUE_STATUSES } from "@pulseed/event-schema"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@pulseed/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pulseed/ui/components/select"
import { Spinner } from "@pulseed/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@pulseed/ui/components/toggle-group"
import { SearchIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { useSetSearchParams } from "@/components/shell/use-filter-href"

const STATUS_LABELS = {
  unresolved: "Unresolved",
  resolved: "Resolved",
  ignored: "Ignored",
} as const
const SORT_ITEMS = [
  { value: "lastSeen", label: "Last seen" },
  { value: "events", label: "Most events" },
  { value: "users", label: "Most users" },
]

export function IssuesToolbar({ browsers }: { browsers: readonly string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const buildHref = useSetSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  const navigate = (updates: Record<string, string | null>) =>
    startTransition(() =>
      router.replace(buildHref({ ...updates, offset: null }), { scroll: false })
    )

  useEffect(() => () => clearTimeout(debounce.current), [])

  const browserItems = [
    { value: "all", label: "All browsers" },
    ...browsers.map((b) => ({ value: b, label: b })),
  ]

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <InputGroup className="lg:max-w-sm">
        <InputGroupAddon>{pending ? <Spinner /> : <SearchIcon />}</InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search issues and culprits"
          aria-label="Search issues"
          value={q}
          onChange={(event) => {
            const value = event.target.value
            setQ(value)
            clearTimeout(debounce.current)
            debounce.current = setTimeout(() => navigate({ q: value.trim() || null }), 200)
          }}
        />
      </InputGroup>
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Status"
          value={[searchParams.get("status") ?? "unresolved"]}
          onValueChange={(value) =>
            value[0] && navigate({ status: value[0] === "unresolved" ? null : String(value[0]) })
          }
        >
          {ISSUE_STATUSES.map((status) => (
            <ToggleGroupItem key={status} value={status} className="px-2.5">
              {STATUS_LABELS[status]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          items={browserItems}
          value={searchParams.get("browser") ?? "all"}
          onValueChange={(value) => navigate({ browser: value === "all" ? null : String(value) })}
        >
          <SelectTrigger size="sm" aria-label="Browser" className="min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {browserItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={SORT_ITEMS}
          value={searchParams.get("sort") ?? "lastSeen"}
          onValueChange={(value) => navigate({ sort: value === "lastSeen" ? null : String(value) })}
        >
          <SelectTrigger size="sm" aria-label="Sort" className="min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SORT_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
