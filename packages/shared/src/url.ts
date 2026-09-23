const REDACTED = "[redacted]"

const ID_SEGMENT_PATTERNS = [
  /^\d+$/, // 123
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // uuid
  /^[0-9a-f]{16,}$/i, // long hex (object ids, hashes)
  /^[0-9A-HJKMNP-TV-Z]{26}$/, // ulid
]

/**
 * Remove data that may be personal or secret from a URL before it leaves the
 * browser: credentials and fragments are dropped, and every query-parameter
 * value is replaced (keys are kept because they are useful for debugging).
 */
export function redactUrl(input: string, base?: string): string {
  let url: URL
  try {
    url = new URL(input, base)
  } catch {
    return input.split(/[?#]/)[0] ?? ""
  }

  url.username = ""
  url.password = ""
  url.hash = ""
  for (const key of new Set(url.searchParams.keys())) {
    url.searchParams.set(key, REDACTED)
  }
  // URLSearchParams encodes the brackets; keep the marker readable.
  return url.toString().replaceAll(encodeURIComponent(REDACTED), REDACTED)
}

/**
 * Collapse a request URL to an endpoint template for grouping:
 * `https://x.com/api/orders/123?page=2` -> `/api/orders/:id`.
 */
export function normalizeEndpoint(input: string, base?: string): string {
  let pathname: string
  try {
    pathname = new URL(input, base ?? "http://localhost").pathname
  } catch {
    pathname = input.split(/[?#]/)[0] ?? "/"
  }

  const normalized = pathname
    .split("/")
    .map((segment) =>
      ID_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment)) ? ":id" : segment
    )
    .join("/")

  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized
}
