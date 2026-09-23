"use client"

import { DEVICE_TYPES } from "@pulseed/event-schema/constants"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pulseed/ui/components/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { useSetSearchParams } from "@/components/shell/use-filter-href"

function FilterSelect({
  label,
  param,
  items,
}: {
  label: string
  param: string
  items: { value: string; label: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const buildHref = useSetSearchParams()
  const [, startTransition] = useTransition()
  return (
    <Select
      items={items}
      value={searchParams.get(param) ?? "all"}
      onValueChange={(value) =>
        startTransition(() =>
          router.replace(buildHref({ [param]: value === "all" ? null : String(value) }), {
            scroll: false,
          })
        )
      }
    >
      <SelectTrigger size="sm" aria-label={label} className="max-w-64 min-w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

const capitalize = (value: string) => value[0]!.toUpperCase() + value.slice(1)

export function VitalsFilters({
  routes,
  browsers,
}: {
  routes: readonly string[]
  browsers: readonly string[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label="Route"
        param="route"
        items={[
          { value: "all", label: "All routes" },
          ...routes.map((r) => ({ value: r, label: r })),
        ]}
      />
      <FilterSelect
        label="Browser"
        param="browser"
        items={[
          { value: "all", label: "All browsers" },
          ...browsers.map((b) => ({ value: b, label: b })),
        ]}
      />
      <FilterSelect
        label="Device"
        param="device"
        items={[
          { value: "all", label: "All devices" },
          ...DEVICE_TYPES.filter((d) => d !== "unknown").map((d) => ({
            value: d,
            label: capitalize(d),
          })),
        ]}
      />
    </div>
  )
}
