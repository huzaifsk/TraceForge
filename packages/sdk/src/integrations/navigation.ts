import type { NavigationKind } from "@traceforge/event-schema/types"

import type { Integration } from "../hub"

/** Wait for the frame after next: a cheap "the new route has painted" signal. */
const afterPaint = (fn: () => void) =>
  requestAnimationFrame(() => requestAnimationFrame(() => fn()))

function initialKind(): NavigationKind {
  const [entry] = performance.getEntriesByType?.("navigation") ?? []
  return (entry as PerformanceNavigationTiming | undefined)?.type === "reload"
    ? "reload"
    : "initial"
}

/**
 * SPA route changes via the History API (works for React Router and the
 * Next.js App Router, which both use pushState/replaceState).
 * Paths only; query strings never leave the browser.
 */
export const navigationIntegration: Integration = (hub) => {
  let current = location.pathname
  hub.capture({ type: "navigation", payload: { to: current, kind: initialKind() } })

  const onChange = (kind: NavigationKind) => {
    const next = location.pathname
    if (next === current) return // query or hash change on the same route
    const from = current
    current = next
    const start = performance.now()
    afterPaint(() =>
      hub.capture({
        type: "navigation",
        payload: { from, to: next, kind, durationMs: Math.round(performance.now() - start) },
      })
    )
  }

  const nativePush = history.pushState
  const nativeReplace = history.replaceState
  history.pushState = function pushState(this: History, ...args) {
    const result = nativePush.apply(this, args)
    onChange("push")
    return result
  }
  history.replaceState = function replaceState(this: History, ...args) {
    const result = nativeReplace.apply(this, args)
    onChange("replace")
    return result
  }
  const onPop = () => onChange("pop")
  window.addEventListener("popstate", onPop)

  return () => {
    history.pushState = nativePush
    history.replaceState = nativeReplace
    window.removeEventListener("popstate", onPop)
  }
}
