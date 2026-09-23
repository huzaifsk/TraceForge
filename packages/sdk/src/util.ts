/** RFC 4122 v4 UUID. `crypto.randomUUID` only exists in secure contexts, so fall back. */
export function uuid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Truncate to `max` UTF-16 units, marking the cut. */
export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/** Run `fn`, swallowing anything it throws: SDK code must never break the host. */
export function safely<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

/**
 * Describe an arbitrary thrown or rejected value without trusting it:
 * `toString` and `JSON.stringify` can throw, recurse or be enormous.
 */
export function describeValue(value: unknown, max = 512): string {
  if (typeof value === "string") return truncate(value, max)
  if (value === null || value === undefined || typeof value !== "object") return String(value)
  try {
    return truncate(JSON.stringify(value) ?? String(value), max)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/** Run after the browser is idle (or soon), off the critical path. */
export function whenIdle(fn: () => void, timeout = 2_000): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: object) => number })
    .requestIdleCallback
  if (typeof ric === "function") ric(fn, { timeout })
  else setTimeout(fn, 1)
}

export const matches = (value: string, patterns: ReadonlyArray<string | RegExp>): boolean =>
  patterns.some((pattern) =>
    typeof pattern === "string" ? value.includes(pattern) : pattern.test(value)
  )
