"use client"

import { ENVIRONMENTS, TIME_RANGES } from "@traceforge/event-schema"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@traceforge/ui/components/select"
import { ToggleGroup, ToggleGroupItem } from "@traceforge/ui/components/toggle-group"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { useSetSearchParams } from "./use-filter-href"

const ENV_ITEMS = [
  { value: "all", label: "All environments" },
  ...ENVIRONMENTS.map((env) => ({ value: env, label: env[0]!.toUpperCase() + env.slice(1) })),
]

const RANGE_LABELS: Record<(typeof TIME_RANGES)[number], string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
}

/** Global filters live in the URL (`?env=&range=`), so views are shareable and survive reloads. */
export function GlobalFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const buildHref = useSetSearchParams()
  const [pending, startTransition] = useTransition()

  const env = searchParams.get("env") ?? "all"
  const range = searchParams.get("range") ?? "24h"
  const navigate = (updates: Record<string, string | null>) =>
    startTransition(() =>
      router.replace(buildHref({ ...updates, offset: null }), { scroll: false })
    )

  return (
    <div className="flex items-center gap-2" data-pending={pending || undefined}>
      <Select
        items={ENV_ITEMS}
        value={env}
        onValueChange={(value) => navigate({ env: value === "all" ? null : String(value) })}
      >
        <SelectTrigger size="sm" aria-label="Environment" className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {ENV_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Time range"
        value={[range]}
        onValueChange={(value) => {
          const next = value[0]
          if (next) navigate({ range: next === "24h" ? null : String(next) })
        }}
      >
        {TIME_RANGES.map((value) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={`Last ${value}`}
            className="px-2.5 tabular-nums"
          >
            {RANGE_LABELS[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
