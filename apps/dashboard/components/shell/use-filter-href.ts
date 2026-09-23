"use client"

import { useSearchParams } from "next/navigation"
import { useCallback } from "react"

/** Build links that keep the global `range` and `env` filters. */
export function useFilterHref() {
  const searchParams = useSearchParams()
  return useCallback(
    (href: string) => {
      const query = new URLSearchParams()
      for (const key of ["range", "env"]) {
        const value = searchParams.get(key)
        if (value) query.set(key, value)
      }
      const qs = query.toString()
      return qs ? `${href}?${qs}` : href
    },
    [searchParams]
  )
}

/** Replace one or more search params, keeping the rest. `null` removes a param. */
export function useSetSearchParams() {
  const searchParams = useSearchParams()
  return useCallback(
    (updates: Record<string, string | null>, pathname?: string) => {
      const query = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") query.delete(key)
        else query.set(key, value)
      }
      const qs = query.toString()
      return `${pathname ?? window.location.pathname}${qs ? `?${qs}` : ""}`
    },
    [searchParams]
  )
}
