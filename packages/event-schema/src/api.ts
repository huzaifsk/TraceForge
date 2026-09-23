/**
 * Dashboard query API contract (API → dashboard). Separate from the ingestion
 * wire format: these shapes are internal to TraceForge and may evolve with
 * the dashboard, but both sides validate against the same schemas.
 */
import { z } from "zod"

import { DEVICE_TYPES, ENVIRONMENTS, WEB_VITAL_NAMES, WEB_VITAL_RATINGS } from "./constants"

export const TIME_RANGES = ["1h", "24h", "7d", "30d"] as const
export type TimeRange = (typeof TIME_RANGES)[number]

export const ISSUE_STATUSES = ["unresolved", "resolved", "ignored"] as const
export type IssueStatus = (typeof ISSUE_STATUSES)[number]

export const PLATFORMS = ["javascript", "react", "nextjs"] as const
export type Platform = (typeof PLATFORMS)[number]

export const rangeQuerySchema = z.object({
  range: z.enum(TIME_RANGES).default("24h"),
  environment: z.enum(ENVIRONMENTS).optional(),
})

const count = z.number().int().nonnegative()
const nullableNumber = z.number().nullable()

/** Evenly spaced buckets covering the range; `t` is the bucket start in epoch ms. */
export const seriesSchema = <T extends z.ZodRawShape>(shape: T) =>
  z.array(z.object({ t: z.number(), ...shape }))

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.enum(PLATFORMS),
  status: z.enum(["active", "paused"]),
  allowedOrigins: z.array(z.string()),
  publicKey: z.string(),
  dsn: z.string(),
  createdAt: z.string(),
  /** ISO time of the newest event, or null before the first event arrives. */
  lastEventAt: z.string().nullable(),
})

const vitalSummarySchema = z.object({
  name: z.enum(WEB_VITAL_NAMES),
  p75: nullableNumber,
  rating: z.enum(WEB_VITAL_RATINGS).nullable(),
  samples: count,
  distribution: z.object({ good: count, "needs-improvement": count, poor: count }),
})

const kpiSchema = z.object({ value: z.number(), previous: z.number() })

export const overviewSchema = z.object({
  range: z.enum(TIME_RANGES),
  bucketMs: z.number(),
  kpis: z.object({
    errors: kpiSchema,
    apiFailures: kpiSchema,
    users: kpiSchema,
    /** Share of sessions with at least one error, 0–1. */
    errorRate: kpiSchema,
  }),
  trend: seriesSchema({ errors: count, rejections: count, apiFailures: count, users: count }),
  vitals: z.array(vitalSummarySchema),
  topIssues: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      events: count,
      users: count,
      sparkline: z.array(count),
    })
  ),
  slowestEndpoints: z.array(
    z.object({ method: z.string(), endpoint: z.string(), requests: count, p95: z.number() })
  ),
  failingEndpoints: z.array(
    z.object({ method: z.string(), endpoint: z.string(), requests: count, errors: count })
  ),
})

export const issueListItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  culprit: z.string().nullable(),
  status: z.enum(ISSUE_STATUSES),
  firstSeen: z.string(),
  lastSeen: z.string(),
  events: count,
  users: count,
  totalEvents: count,
  totalUsers: count,
  sparkline: z.array(count),
})

export const issuesQuerySchema = rangeQuerySchema.extend({
  status: z.enum(ISSUE_STATUSES).default("unresolved"),
  q: z.string().trim().max(200).optional(),
  browser: z.string().max(64).optional(),
  sort: z.enum(["lastSeen", "events", "users"]).default("lastSeen"),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
})

export const issueListSchema = z.object({
  issues: z.array(issueListItemSchema),
  hasMore: z.boolean(),
  browsers: z.array(z.string()),
})

const breakdownSchema = z.array(z.object({ value: z.string(), count }))

export const frameSchema = z.object({
  function: z.string().optional(),
  filename: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  inApp: z.boolean(),
})

export const issueDetailSchema = z.object({
  issue: issueListItemSchema.omit({ sparkline: true, events: true, users: true }).extend({
    fingerprint: z.string(),
    firstRelease: z.string().nullable(),
  }),
  events: count,
  users: count,
  bucketMs: z.number(),
  trend: seriesSchema({ events: count }),
  breakdowns: z.object({
    browser: breakdownSchema,
    os: breakdownSchema,
    deviceType: breakdownSchema,
    path: breakdownSchema,
  }),
  latestEvent: z
    .object({
      id: z.string(),
      timestamp: z.string(),
      environment: z.enum(ENVIRONMENTS),
      release: z.string().nullable(),
      url: z.string(),
      path: z.string(),
      device: z.object({
        browser: z.string(),
        browserVersion: z.string().optional(),
        os: z.string(),
        osVersion: z.string().optional(),
        deviceType: z.enum(DEVICE_TYPES),
        viewport: z.object({ width: z.number(), height: z.number() }).optional(),
        language: z.string().optional(),
        connection: z.string().optional(),
      }),
      name: z.string().optional(),
      message: z.string().optional(),
      stack: z.string().optional(),
      frames: z.array(frameSchema),
      componentStack: z.string().optional(),
      request: z
        .object({
          method: z.string(),
          url: z.string(),
          status: z.number(),
          durationMs: z.number(),
          errorKind: z.string(),
        })
        .optional(),
    })
    .nullable(),
})

export const updateIssueSchema = z.object({ status: z.enum(ISSUE_STATUSES) })

export const endpointRowSchema = z.object({
  method: z.string(),
  endpoint: z.string(),
  requests: count,
  errors: count,
  errorRate: z.number(),
  avg: z.number(),
  p95: z.number(),
  sparkline: z.array(z.number()),
})

export const endpointListSchema = z.object({ endpoints: z.array(endpointRowSchema) })

export const endpointQuerySchema = rangeQuerySchema.extend({
  method: z.string().max(10),
  endpoint: z.string().max(2_048),
})

export const endpointDetailSchema = z.object({
  method: z.string(),
  endpoint: z.string(),
  requests: count,
  errors: count,
  errorRate: z.number(),
  avg: nullableNumber,
  p50: nullableNumber,
  p95: nullableNumber,
  bucketMs: z.number(),
  latency: seriesSchema({ p50: nullableNumber, p95: nullableNumber, requests: count }),
  statuses: z.object({ "2xx": count, "3xx": count, "4xx": count, "5xx": count, network: count }),
  recentFailures: z.array(
    z.object({
      id: z.string(),
      timestamp: z.string(),
      status: z.number(),
      errorKind: z.string().nullable(),
      durationMs: z.number(),
      browser: z.string(),
      route: z.string().nullable(),
    })
  ),
})

export const vitalsQuerySchema = rangeQuerySchema.extend({
  route: z.string().max(2_048).optional(),
  browser: z.string().max(64).optional(),
  deviceType: z.enum(DEVICE_TYPES).optional(),
})

export const vitalsSchema = z.object({
  bucketMs: z.number(),
  vitals: z.array(vitalSummarySchema.extend({ trend: seriesSchema({ p75: nullableNumber }) })),
  routes: z.array(
    z.object({
      route: z.string(),
      loads: count,
      lcp: nullableNumber,
      inp: nullableNumber,
      cls: nullableNumber,
    })
  ),
  facets: z.object({ routes: z.array(z.string()), browsers: z.array(z.string()) }),
})

/** One row of the live stream (SSE `data:`). Summaries only — no stacks. */
export const liveEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(),
  path: z.string(),
  environment: z.enum(ENVIRONMENTS),
  summary: z.string(),
  issueId: z.string().nullable().optional(),
})

export type Project = z.infer<typeof projectSchema>
export type Overview = z.infer<typeof overviewSchema>
export type VitalSummary = z.infer<typeof vitalSummarySchema>
export type IssueListItem = z.infer<typeof issueListItemSchema>
export type IssueList = z.infer<typeof issueListSchema>
export type IssueDetail = z.infer<typeof issueDetailSchema>
export type IssueFrame = z.infer<typeof frameSchema>
export type EndpointRow = z.infer<typeof endpointRowSchema>
export type EndpointList = z.infer<typeof endpointListSchema>
export type EndpointDetail = z.infer<typeof endpointDetailSchema>
export type Vitals = z.infer<typeof vitalsSchema>
export type LiveEvent = z.infer<typeof liveEventSchema>
