import type { Integration } from "../hub"
import { whenIdle } from "../util"

const ms = (value: number) => (value > 0 ? Math.round(value) : undefined)

/** One Navigation Timing summary per page load, read after load when the browser is idle. */
export const performanceIntegration: Integration = (hub) => {
  let cancelled = false
  let longTasks = 0
  let observer: PerformanceObserver | undefined
  try {
    observer = new PerformanceObserver((list) => (longTasks += list.getEntries().length))
    observer.observe({ type: "longtask", buffered: true })
  } catch {
    observer = undefined // Long Tasks API unsupported (Firefox, Safari)
  }

  const report = () =>
    whenIdle(() => {
      if (cancelled) return
      const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]
      if (!entry) return
      const payload = {
        ttfbMs: ms(entry.responseStart - entry.startTime),
        domContentLoadedMs: ms(entry.domContentLoadedEventEnd - entry.startTime),
        loadMs: ms(entry.loadEventEnd - entry.startTime),
        transferBytes: entry.transferSize > 0 ? entry.transferSize : undefined,
        resourceCount: performance.getEntriesByType("resource").length,
        ...(observer && { longTaskCount: longTasks }),
      }
      hub.capture({
        type: "performance",
        payload: Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)),
      })
    })

  // loadEventEnd is only set after the load handler returns, hence the timeout.
  const onLoad = () => setTimeout(report, 0)
  if (document.readyState === "complete") onLoad()
  else window.addEventListener("load", onLoad, { once: true })

  return () => {
    cancelled = true
    observer?.disconnect()
    window.removeEventListener("load", onLoad)
  }
}
