import type {
  EndpointDetail,
  EndpointList,
  Environment,
  IssueDetail,
  IssueList,
  IssueStatus,
  Overview,
  TimeRange,
  Vitals,
  VitalSummary,
} from "@traceforge/event-schema"
import { WEB_VITAL_NAMES, type WebVitalName } from "@traceforge/event-schema/constants"
import { parseStack, rateWebVital } from "@traceforge/shared"
import type postgres from "postgres"

/*
 * Aggregations for the dashboard, done in SQL. Every numeric column is cast
 * (::int / ::float8) so postgres.js returns numbers, and timestamps come back
 * as epoch milliseconds, converted to ISO strings here.
 */

type Sql = postgres.Sql
type Fragment = postgres.PendingQuery<postgres.Row[]>

const HOUR = 3_600_000
const RANGE_SPEC: Record<TimeRange, { ms: number; bucketMs: number }> = {
  "1h": { ms: HOUR, bucketMs: 60_000 },
  "24h": { ms: 24 * HOUR, bucketMs: 30 * 60_000 },
  "7d": { ms: 7 * 24 * HOUR, bucketMs: 3 * HOUR },
  "30d": { ms: 30 * 24 * HOUR, bucketMs: 12 * HOUR },
}
const SPARKLINE_BUCKETS = 24

export interface Window {
  range: TimeRange
  start: number
  end: number
  bucketMs: number
  buckets: number
  /** Start of the previous equal-length period, for deltas. */
  previousStart: number
}

/** Bucket-aligned window ending at the current bucket. */
export function timeWindow(range: TimeRange, now = Date.now()): Window {
  const { ms, bucketMs } = RANGE_SPEC[range]
  const end = Math.ceil((now + 1) / bucketMs) * bucketMs
  const start = end - ms
  return { range, start, end, bucketMs, buckets: ms / bucketMs, previousStart: start - ms }
}

/**
 * Timestamp parameter. Drizzle reconfigures the shared postgres.js client so it
 * no longer serializes Date objects, so pass ISO strings (cast in SQL).
 */
const ts = (ms: number) => new Date(ms).toISOString()

const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString())

/** Dense series: one entry per bucket, filled from sparse SQL rows keyed by bucket index. */
function fill<T extends Record<string, unknown>>(
  window: Pick<Window, "start" | "bucketMs" | "buckets">,
  rows: readonly ({ b: number } & T)[],
  empty: T
): ({ t: number } & T)[] {
  const byBucket = new Map(rows.map((row) => [row.b, row]))
  return Array.from({ length: window.buckets }, (_, b) => {
    const row = byBucket.get(b)
    const values = { ...empty }
    if (row)
      for (const key of Object.keys(empty) as (keyof T)[]) values[key] = row[key] as T[keyof T]
    return { t: window.start + b * window.bucketMs, ...values }
  })
}

const bucketOf = (sql: Sql, window: Pick<Window, "start" | "bucketMs">) =>
  sql`floor((extract(epoch from timestamp) * 1000 - ${window.start}) / ${window.bucketMs})::int`

const envFilter = (sql: Sql, environment?: Environment): Fragment =>
  environment ? sql`and environment = ${environment}` : sql``

const inWindow = (sql: Sql, window: Window) =>
  sql`timestamp >= ${ts(window.start)}::timestamptz and timestamp < ${ts(window.end)}::timestamptz`

function summarizeVital(
  name: WebVitalName,
  row: { p75: number | null; samples: number; good: number; ni: number; poor: number } | undefined
): VitalSummary {
  const p75 = row?.p75 ?? null
  return {
    name,
    p75,
    rating: p75 === null ? null : rateWebVital(name, p75),
    samples: row?.samples ?? 0,
    distribution: {
      good: row?.good ?? 0,
      "needs-improvement": row?.ni ?? 0,
      poor: row?.poor ?? 0,
    },
  }
}

async function vitalSummaries(
  sql: Sql,
  projectId: string,
  window: Window,
  where: Fragment
): Promise<Map<string, VitalSummary>> {
  const rows = await sql<
    {
      name: WebVitalName
      p75: number | null
      samples: number
      good: number
      ni: number
      poor: number
    }[]
  >`
    select name::text as name,
      percentile_cont(0.75) within group (order by value)::float8 as p75,
      count(*)::int as samples,
      count(*) filter (where rating = 'good')::int as good,
      count(*) filter (where rating = 'needs-improvement')::int as ni,
      count(*) filter (where rating = 'poor')::int as poor
    from web_vitals
    where project_id = ${projectId} and ${inWindow(sql, window)} ${where}
    group by name
  `
  const byName = new Map(rows.map((row) => [row.name, row]))
  return new Map(WEB_VITAL_NAMES.map((name) => [name, summarizeVital(name, byName.get(name))]))
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getOverview(
  sql: Sql,
  projectId: string,
  range: TimeRange,
  environment?: Environment
): Promise<Overview> {
  const window = timeWindow(range)
  const env = envFilter(sql, environment)
  const current = sql`timestamp >= ${ts(window.start)}::timestamptz`
  const isError = sql`type in ('error', 'unhandled_rejection')`

  const [totals] = await sql<
    {
      errors: number
      prev_errors: number
      api_failures: number
      prev_api_failures: number
      users: number
      prev_users: number
      sessions: number
      prev_sessions: number
      error_sessions: number
      prev_error_sessions: number
    }[]
  >`
    select
      count(*) filter (where ${isError} and ${current})::int as errors,
      count(*) filter (where ${isError} and not ${current})::int as prev_errors,
      count(*) filter (where type = 'api_error' and ${current})::int as api_failures,
      count(*) filter (where type = 'api_error' and not ${current})::int as prev_api_failures,
      count(distinct coalesce(anonymous_id, session_id)) filter (where ${current})::int as users,
      count(distinct coalesce(anonymous_id, session_id)) filter (where not ${current})::int as prev_users,
      count(distinct session_id) filter (where ${current})::int as sessions,
      count(distinct session_id) filter (where not ${current})::int as prev_sessions,
      count(distinct session_id) filter (where ${isError} and ${current})::int as error_sessions,
      count(distinct session_id) filter (where ${isError} and not ${current})::int as prev_error_sessions
    from events
    where project_id = ${projectId}
      and timestamp >= ${ts(window.previousStart)}::timestamptz and timestamp < ${ts(window.end)}::timestamptz
      ${env}
  `

  const trendRows = await sql<
    { b: number; errors: number; rejections: number; apiFailures: number; users: number }[]
  >`
    select ${bucketOf(sql, window)} as b,
      count(*) filter (where type = 'error')::int as "errors",
      count(*) filter (where type = 'unhandled_rejection')::int as "rejections",
      count(*) filter (where type = 'api_error')::int as "apiFailures",
      count(distinct coalesce(anonymous_id, session_id))::int as "users"
    from events
    where project_id = ${projectId} and ${inWindow(sql, window)} ${env}
    group by b
  `

  const vitals = await vitalSummaries(sql, projectId, window, env)

  const topIssues = await sql<
    {
      id: string
      title: string
      type: string
      fingerprint: string
      events: number
      users: number
    }[]
  >`
    select i.id::text as id, i.title, i.type::text as type, i.fingerprint,
      count(*)::int as events,
      count(distinct coalesce(e.anonymous_id, e.session_id))::int as users
    from events e
    join issues i on i.project_id = e.project_id and i.fingerprint = e.fingerprint
    where e.project_id = ${projectId} and e.fingerprint is not null
      and e.timestamp >= ${ts(window.start)}::timestamptz and e.timestamp < ${ts(window.end)}::timestamptz
      and i.status = 'unresolved'
      ${environment ? sql`and e.environment = ${environment}` : sql``}
    group by i.id
    order by events desc, i.id
    limit 5
  `
  const sparklines = await issueSparklines(
    sql,
    projectId,
    window,
    topIssues.map((issue) => issue.fingerprint),
    environment
  )

  const endpoints = await sql<
    { method: string; endpoint: string; requests: number; errors: number; p95: number }[]
  >`
    select method, endpoint,
      count(*)::int as requests,
      count(*) filter (where error_kind is not null)::int as errors,
      percentile_cont(0.95) within group (order by duration_ms)::float8 as p95
    from api_requests
    where project_id = ${projectId} and ${inWindow(sql, window)} ${env}
    group by method, endpoint
  `

  const rate = (errorSessions: number, sessions: number) =>
    sessions > 0 ? errorSessions / sessions : 0

  return {
    range,
    bucketMs: window.bucketMs,
    kpis: {
      errors: { value: totals?.errors ?? 0, previous: totals?.prev_errors ?? 0 },
      apiFailures: { value: totals?.api_failures ?? 0, previous: totals?.prev_api_failures ?? 0 },
      users: { value: totals?.users ?? 0, previous: totals?.prev_users ?? 0 },
      errorRate: {
        value: rate(totals?.error_sessions ?? 0, totals?.sessions ?? 0),
        previous: rate(totals?.prev_error_sessions ?? 0, totals?.prev_sessions ?? 0),
      },
    },
    trend: fill(window, trendRows, { errors: 0, rejections: 0, apiFailures: 0, users: 0 }),
    vitals: (["LCP", "INP", "CLS"] as const).map((name) => vitals.get(name)!),
    topIssues: topIssues.map(({ fingerprint, ...issue }) => ({
      ...issue,
      sparkline: sparklines.get(fingerprint) ?? new Array(SPARKLINE_BUCKETS).fill(0),
    })),
    slowestEndpoints: [...endpoints]
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 5)
      .map(({ method, endpoint, requests, p95 }) => ({ method, endpoint, requests, p95 })),
    failingEndpoints: endpoints
      .filter((row) => row.errors > 0)
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 5)
      .map(({ method, endpoint, requests, errors }) => ({ method, endpoint, requests, errors })),
  }
}

/** 24-bucket occurrence counts per fingerprint over the window. */
async function issueSparklines(
  sql: Sql,
  projectId: string,
  window: Window,
  fingerprints: readonly string[],
  environment?: Environment
): Promise<Map<string, number[]>> {
  if (fingerprints.length === 0) return new Map()
  const spark = { start: window.start, bucketMs: (window.end - window.start) / SPARKLINE_BUCKETS }
  const rows = await sql<{ fingerprint: string; b: number; n: number }[]>`
    select fingerprint, ${bucketOf(sql, spark)} as b, count(*)::int as n
    from events
    where project_id = ${projectId} and fingerprint in ${sql(fingerprints as string[])}
      and ${inWindow(sql, window)} ${envFilter(sql, environment)}
    group by fingerprint, b
  `
  const out = new Map<string, number[]>()
  for (const row of rows) {
    const series = out.get(row.fingerprint) ?? new Array<number>(SPARKLINE_BUCKETS).fill(0)
    if (row.b >= 0 && row.b < SPARKLINE_BUCKETS) series[row.b] = row.n
    out.set(row.fingerprint, series)
  }
  return out
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50

interface IssueRow {
  id: string
  fingerprint: string
  type: string
  title: string
  culprit: string | null
  status: IssueStatus
  first_seen: number
  last_seen: number
  total_events: number
  total_users: number
  events: number
  users: number
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

export async function listIssues(
  sql: Sql,
  projectId: string,
  query: {
    range: TimeRange
    environment?: Environment
    status: IssueStatus
    q?: string
    browser?: string
    sort: "lastSeen" | "events" | "users"
    offset: number
  }
): Promise<IssueList> {
  const window = timeWindow(query.range)
  const order = {
    lastSeen: sql`s.last_in_range desc`,
    events: sql`s.events desc`,
    users: sql`s.users desc`,
  }[query.sort]

  const rows = await sql<IssueRow[]>`
    with scoped as (
      select fingerprint,
        count(*)::int as events,
        count(distinct coalesce(anonymous_id, session_id))::int as users,
        max(timestamp) as last_in_range
      from events
      where project_id = ${projectId} and fingerprint is not null and ${inWindow(sql, window)}
        ${envFilter(sql, query.environment)}
        ${query.browser ? sql`and browser = ${query.browser}` : sql``}
      group by fingerprint
    )
    select i.id::text as id, i.fingerprint, i.type::text as type, i.title, i.culprit,
      i.status::text as status,
      (extract(epoch from i.first_seen) * 1000)::float8 as first_seen,
      (extract(epoch from i.last_seen) * 1000)::float8 as last_seen,
      i.occurrence_count::int as total_events, i.affected_users as total_users,
      s.events, s.users
    from scoped s
    join issues i on i.project_id = ${projectId} and i.fingerprint = s.fingerprint
    where i.status = ${query.status}
      ${query.q ? sql`and (i.title ilike ${`%${escapeLike(query.q)}%`} or i.culprit ilike ${`%${escapeLike(query.q)}%`})` : sql``}
    order by ${order}, i.id
    limit ${PAGE_SIZE + 1} offset ${query.offset}
  `

  const page = rows.slice(0, PAGE_SIZE)
  const sparklines = await issueSparklines(
    sql,
    projectId,
    window,
    page.map((row) => row.fingerprint),
    query.environment
  )
  const browsers = await sql<{ browser: string }[]>`
    select browser from events
    where project_id = ${projectId} and fingerprint is not null and ${inWindow(sql, window)}
    group by browser order by count(*) desc limit 20
  `

  return {
    issues: page.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      culprit: row.culprit,
      status: row.status,
      firstSeen: iso(row.first_seen)!,
      lastSeen: iso(row.last_seen)!,
      events: row.events,
      users: row.users,
      totalEvents: row.total_events,
      totalUsers: row.total_users,
      sparkline: sparklines.get(row.fingerprint) ?? new Array(SPARKLINE_BUCKETS).fill(0),
    })),
    hasMore: rows.length > PAGE_SIZE,
    browsers: browsers.map((row) => row.browser),
  }
}

interface EventRow {
  id: string
  timestamp: number
  environment: Environment
  release: string | null
  path: string
  context: {
    page: { url: string; path: string }
    device: NonNullable<IssueDetail["latestEvent"]>["device"]
  }
  payload: Record<string, unknown>
}

export async function getIssue(
  sql: Sql,
  projectId: string,
  issueId: string,
  range: TimeRange,
  environment?: Environment
): Promise<IssueDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(issueId)) return null
  const [issue] = await sql<Omit<IssueRow, "events" | "users">[]>`
    select id::text as id, fingerprint, type::text as type, title, culprit, status::text as status,
      (extract(epoch from first_seen) * 1000)::float8 as first_seen,
      (extract(epoch from last_seen) * 1000)::float8 as last_seen,
      occurrence_count::int as total_events, affected_users as total_users
    from issues where project_id = ${projectId} and id = ${issueId}
  `
  if (!issue) return null

  const window = timeWindow(range)
  const env = envFilter(sql, environment)
  const scope = sql`project_id = ${projectId} and fingerprint = ${issue.fingerprint}`

  const [stats] = await sql<{ events: number; users: number }[]>`
    select count(*)::int as events, count(distinct coalesce(anonymous_id, session_id))::int as users
    from events where ${scope} and ${inWindow(sql, window)} ${env}
  `
  const trendRows = await sql<{ b: number; events: number }[]>`
    select ${bucketOf(sql, window)} as b, count(*)::int as events
    from events where ${scope} and ${inWindow(sql, window)} ${env}
    group by b
  `
  const breakdownRows = await sql<{ dim: string; value: string; count: number }[]>`
    select case
        when grouping(browser) = 0 then 'browser'
        when grouping(os) = 0 then 'os'
        when grouping(device_type) = 0 then 'deviceType'
        else 'path' end as dim,
      coalesce(browser, os, device_type, path) as value,
      count(*)::int as count
    from events where ${scope} and ${inWindow(sql, window)} ${env}
    group by grouping sets ((browser), (os), (device_type), (path))
    order by count desc
  `
  const breakdown = (dim: string) =>
    breakdownRows
      .filter((row) => row.dim === dim)
      .slice(0, 5)
      .map(({ value, count }) => ({ value, count }))

  const [latest] = await sql<EventRow[]>`
    select id::text as id, (extract(epoch from timestamp) * 1000)::float8 as timestamp,
      environment::text as environment, release, path, context, payload
    from events where ${scope} ${env}
    order by timestamp desc limit 1
  `
  const [first] = await sql<{ release: string | null }[]>`
    select release from events where ${scope} and release is not null order by timestamp asc limit 1
  `

  const payload = (latest?.payload ?? {}) as {
    name?: string
    message?: string
    stack?: string
    componentStack?: string
    method?: string
    url?: string
    status?: number
    durationMs?: number
    errorKind?: string
  }
  const frames = parseStack(payload.stack).map((frame) => ({
    ...(frame.function && { function: frame.function }),
    ...(frame.filename && { filename: frame.filename }),
    ...(frame.line !== undefined && { line: frame.line }),
    ...(frame.column !== undefined && { column: frame.column }),
    inApp: frame.inApp !== false,
  }))

  return {
    issue: {
      id: issue.id,
      type: issue.type,
      title: issue.title,
      culprit: issue.culprit,
      status: issue.status,
      fingerprint: issue.fingerprint,
      firstSeen: iso(issue.first_seen)!,
      lastSeen: iso(issue.last_seen)!,
      totalEvents: issue.total_events,
      totalUsers: issue.total_users,
      firstRelease: first?.release ?? null,
    },
    events: stats?.events ?? 0,
    users: stats?.users ?? 0,
    bucketMs: window.bucketMs,
    trend: fill(window, trendRows, { events: 0 }),
    breakdowns: {
      browser: breakdown("browser"),
      os: breakdown("os"),
      deviceType: breakdown("deviceType"),
      path: breakdown("path"),
    },
    latestEvent: latest
      ? {
          id: latest.id,
          timestamp: iso(latest.timestamp)!,
          environment: latest.environment,
          release: latest.release,
          url: latest.context.page.url,
          path: latest.path,
          device: latest.context.device,
          ...(payload.name && { name: payload.name }),
          ...(payload.message !== undefined && { message: payload.message }),
          ...(payload.stack && { stack: payload.stack }),
          frames,
          ...(payload.componentStack && { componentStack: payload.componentStack }),
          ...(payload.method && {
            request: {
              method: payload.method,
              url: payload.url ?? "",
              status: payload.status ?? 0,
              durationMs: payload.durationMs ?? 0,
              errorKind: payload.errorKind ?? "http",
            },
          }),
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// API performance
// ---------------------------------------------------------------------------

export async function listEndpoints(
  sql: Sql,
  projectId: string,
  range: TimeRange,
  environment?: Environment
): Promise<EndpointList> {
  const window = timeWindow(range)
  const env = envFilter(sql, environment)
  const rows = await sql<
    {
      method: string
      endpoint: string
      requests: number
      errors: number
      avg: number
      p95: number
    }[]
  >`
    select method, endpoint,
      count(*)::int as requests,
      count(*) filter (where error_kind is not null)::int as errors,
      avg(duration_ms)::float8 as avg,
      percentile_cont(0.95) within group (order by duration_ms)::float8 as p95
    from api_requests
    where project_id = ${projectId} and ${inWindow(sql, window)} ${env}
    group by method, endpoint
    order by requests desc, endpoint
    limit 100
  `
  const spark = { start: window.start, bucketMs: (window.end - window.start) / SPARKLINE_BUCKETS }
  const sparkRows = await sql<{ method: string; endpoint: string; b: number; p95: number }[]>`
    select method, endpoint, ${bucketOf(sql, spark)} as b,
      percentile_cont(0.95) within group (order by duration_ms)::float8 as p95
    from api_requests
    where project_id = ${projectId} and ${inWindow(sql, window)} ${env}
    group by method, endpoint, b
  `
  const sparklines = new Map<string, number[]>()
  for (const row of sparkRows) {
    const key = `${row.method} ${row.endpoint}`
    const series = sparklines.get(key) ?? new Array<number>(SPARKLINE_BUCKETS).fill(0)
    if (row.b >= 0 && row.b < SPARKLINE_BUCKETS) series[row.b] = row.p95
    sparklines.set(key, series)
  }

  return {
    endpoints: rows.map((row) => ({
      ...row,
      errorRate: row.requests > 0 ? row.errors / row.requests : 0,
      sparkline:
        sparklines.get(`${row.method} ${row.endpoint}`) ?? new Array(SPARKLINE_BUCKETS).fill(0),
    })),
  }
}

export async function getEndpoint(
  sql: Sql,
  projectId: string,
  query: { method: string; endpoint: string; range: TimeRange; environment?: Environment }
): Promise<EndpointDetail> {
  const window = timeWindow(query.range)
  const scope = sql`project_id = ${projectId} and method = ${query.method} and endpoint = ${query.endpoint}
    and ${inWindow(sql, window)} ${envFilter(sql, query.environment)}`

  const [stats] = await sql<
    {
      requests: number
      errors: number
      avg: number | null
      p50: number | null
      p95: number | null
      s2: number
      s3: number
      s4: number
      s5: number
      network: number
    }[]
  >`
    select count(*)::int as requests,
      count(*) filter (where error_kind is not null)::int as errors,
      avg(duration_ms)::float8 as avg,
      percentile_cont(0.5) within group (order by duration_ms)::float8 as p50,
      percentile_cont(0.95) within group (order by duration_ms)::float8 as p95,
      count(*) filter (where status between 200 and 299)::int as s2,
      count(*) filter (where status between 300 and 399)::int as s3,
      count(*) filter (where status between 400 and 499)::int as s4,
      count(*) filter (where status >= 500)::int as s5,
      count(*) filter (where status = 0)::int as network
    from api_requests where ${scope}
  `
  const latencyRows = await sql<{ b: number; p50: number; p95: number; requests: number }[]>`
    select ${bucketOf(sql, window)} as b,
      percentile_cont(0.5) within group (order by duration_ms)::float8 as p50,
      percentile_cont(0.95) within group (order by duration_ms)::float8 as p95,
      count(*)::int as requests
    from api_requests where ${scope}
    group by b
  `
  const failures = await sql<
    {
      id: string
      timestamp: number
      status: number
      error_kind: string | null
      duration_ms: number
      browser: string
      route: string | null
    }[]
  >`
    select id::text as id, (extract(epoch from timestamp) * 1000)::float8 as timestamp, status::int as status,
      error_kind, duration_ms::float8 as duration_ms, browser, route
    from api_requests where ${scope} and error_kind is not null
    order by timestamp desc limit 20
  `

  const requests = stats?.requests ?? 0
  const errors = stats?.errors ?? 0
  return {
    method: query.method,
    endpoint: query.endpoint,
    requests,
    errors,
    errorRate: requests > 0 ? errors / requests : 0,
    avg: stats?.avg ?? null,
    p50: stats?.p50 ?? null,
    p95: stats?.p95 ?? null,
    bucketMs: window.bucketMs,
    latency: fill(window, latencyRows, {
      p50: null as number | null,
      p95: null as number | null,
      requests: 0,
    }),
    statuses: {
      "2xx": stats?.s2 ?? 0,
      "3xx": stats?.s3 ?? 0,
      "4xx": stats?.s4 ?? 0,
      "5xx": stats?.s5 ?? 0,
      network: stats?.network ?? 0,
    },
    recentFailures: failures.map((row) => ({
      id: row.id,
      timestamp: iso(row.timestamp)!,
      status: row.status,
      errorKind: row.error_kind,
      durationMs: row.duration_ms,
      browser: row.browser,
      route: row.route,
    })),
  }
}

// ---------------------------------------------------------------------------
// Web Vitals
// ---------------------------------------------------------------------------

export async function getVitals(
  sql: Sql,
  projectId: string,
  query: {
    range: TimeRange
    environment?: Environment
    route?: string
    browser?: string
    deviceType?: string
  }
): Promise<Vitals> {
  const window = timeWindow(query.range)
  const filters = sql`${envFilter(sql, query.environment)}
    ${query.route ? sql`and route = ${query.route}` : sql``}
    ${query.browser ? sql`and browser = ${query.browser}` : sql``}
    ${query.deviceType ? sql`and device_type = ${query.deviceType}` : sql``}`

  const summaries = await vitalSummaries(sql, projectId, window, filters)
  const trendRows = await sql<{ name: WebVitalName; b: number; p75: number }[]>`
    select name::text as name, ${bucketOf(sql, window)} as b,
      percentile_cont(0.75) within group (order by value)::float8 as p75
    from web_vitals
    where project_id = ${projectId} and ${inWindow(sql, window)} ${filters}
    group by name, b
  `
  const routes = await sql<
    { route: string; loads: number; lcp: number | null; inp: number | null; cls: number | null }[]
  >`
    select coalesce(route, path) as route,
      count(*) filter (where name = 'LCP')::int as loads,
      (percentile_cont(0.75) within group (order by value) filter (where name = 'LCP'))::float8 as lcp,
      (percentile_cont(0.75) within group (order by value) filter (where name = 'INP'))::float8 as inp,
      (percentile_cont(0.75) within group (order by value) filter (where name = 'CLS'))::float8 as cls
    from web_vitals
    where project_id = ${projectId} and ${inWindow(sql, window)} ${filters}
    group by 1
    order by lcp desc nulls last, loads desc
    limit 20
  `
  const facetRoutes = await sql<{ route: string }[]>`
    select coalesce(route, path) as route from web_vitals
    where project_id = ${projectId} and ${inWindow(sql, window)}
    group by 1 order by count(*) desc limit 50
  `
  const facetBrowsers = await sql<{ browser: string }[]>`
    select browser from web_vitals
    where project_id = ${projectId} and ${inWindow(sql, window)}
    group by browser order by count(*) desc limit 20
  `

  return {
    bucketMs: window.bucketMs,
    vitals: WEB_VITAL_NAMES.map((name) => ({
      ...summaries.get(name)!,
      trend: fill(
        window,
        trendRows.filter((row) => row.name === name),
        { p75: null as number | null }
      ),
    })),
    routes,
    facets: {
      routes: facetRoutes.map((row) => row.route),
      browsers: facetBrowsers.map((row) => row.browser),
    },
  }
}
