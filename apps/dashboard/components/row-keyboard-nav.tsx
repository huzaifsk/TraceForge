"use client"

import { useEffect } from "react"

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/** j / k move focus between `[data-row-link]` elements; Enter follows the link natively. */
export function RowKeyboardNav() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      if (event.key !== "j" && event.key !== "k") return
      const links = [...document.querySelectorAll<HTMLElement>("[data-row-link]")]
      if (links.length === 0) return
      event.preventDefault()
      const index = links.indexOf(document.activeElement as HTMLElement)
      const next =
        event.key === "j" ? Math.min(index + 1, links.length - 1) : Math.max(index - 1, 0)
      links[index === -1 ? 0 : next]?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
  return null
}
