"use client"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@traceforge/ui/components/input-group"
import { Spinner } from "@traceforge/ui/components/spinner"
import { SearchIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { useSetSearchParams } from "@/components/shell/use-filter-href"

export function SessionsToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const buildHref = useSetSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(debounce.current), [])

  return (
    <InputGroup className="lg:max-w-sm">
      <InputGroupAddon>{pending ? <Spinner /> : <SearchIcon />}</InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder="Search by session or user id"
        aria-label="Search sessions"
        value={q}
        onChange={(event) => {
          const value = event.target.value
          setQ(value)
          clearTimeout(debounce.current)
          debounce.current = setTimeout(
            () =>
              startTransition(() =>
                router.replace(buildHref({ q: value.trim() || null, offset: null }), {
                  scroll: false,
                })
              ),
            200
          )
        }}
      />
    </InputGroup>
  )
}
