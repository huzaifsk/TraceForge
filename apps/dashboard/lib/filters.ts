import {
  ENVIRONMENTS,
  type Environment,
  TIME_RANGES,
  type TimeRange,
} from "@traceforge/event-schema"

export type SearchParams = Record<string, string | string[] | undefined>

export interface GlobalFilters {
  range: TimeRange
  environment: Environment | undefined
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** Parse the filters shared by every project page (`?range=&env=`), ignoring junk values. */
export function parseFilters(params: SearchParams): GlobalFilters {
  const range = first(params.range)
  const env = first(params.env)
  return {
    range: (TIME_RANGES as readonly string[]).includes(range ?? "") ? (range as TimeRange) : "24h",
    environment: (ENVIRONMENTS as readonly string[]).includes(env ?? "")
      ? (env as Environment)
      : undefined,
  }
}

/** Query string for the API from the global filters plus page-specific params. */
export function apiQuery(
  filters: GlobalFilters,
  extra: Record<string, string | number | undefined> = {}
): string {
  const query = new URLSearchParams({ range: filters.range })
  if (filters.environment) query.set("environment", filters.environment)
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") query.set(key, String(value))
  }
  return query.toString()
}

/** Keep `range` and `env` when linking between project pages. */
export function withFilters(
  href: string,
  params: SearchParams,
  extra: Record<string, string> = {}
): string {
  const query = new URLSearchParams()
  const range = first(params.range)
  const env = first(params.env)
  if (range) query.set("range", range)
  if (env) query.set("env", env)
  for (const [key, value] of Object.entries(extra)) query.set(key, value)
  const qs = query.toString()
  return qs ? `${href}?${qs}` : href
}
