import { z } from "zod"

import {
  DEVICE_TYPES,
  ENVIRONMENTS,
  EVENT_TYPES,
  HTTP_METHODS,
  LIMITS,
  SCHEMA_VERSION,
  WEB_VITAL_NAMES,
  WEB_VITAL_RATINGS,
} from "./constants"

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const boundedString = (max: number) => z.string().max(max)
const url = boundedString(LIMITS.maxUrlLength)
const nonNegative = z.number().finite().nonnegative()
/** Durations are milliseconds; cap at 10 minutes to reject clock garbage. */
const durationMs = nonNegative.max(600_000)

export const projectIdSchema = z
  .string()
  .regex(/^tf_[a-z0-9]{8,32}$/, "projectId must look like tf_xxxxxxxx")

export const eventTypeSchema = z.enum(EVENT_TYPES)
export const environmentSchema = z.enum(ENVIRONMENTS)
export const webVitalNameSchema = z.enum(WEB_VITAL_NAMES)
export const webVitalRatingSchema = z.enum(WEB_VITAL_RATINGS)
export const httpMethodSchema = z.enum(HTTP_METHODS)

// ---------------------------------------------------------------------------
// Context shared by every event
// ---------------------------------------------------------------------------

export const pageContextSchema = z.object({
  /** Full URL with query values redacted by the SDK. */
  url,
  path: url,
  /** Route template when the router exposes one, e.g. /orders/[id]. */
  route: url.optional(),
  referrer: url.optional(),
})

export const deviceContextSchema = z.object({
  browser: boundedString(64),
  browserVersion: boundedString(32).optional(),
  os: boundedString(64),
  osVersion: boundedString(32).optional(),
  deviceType: z.enum(DEVICE_TYPES),
  viewport: z
    .object({ width: z.number().int().nonnegative(), height: z.number().int().nonnegative() })
    .optional(),
  language: boundedString(35).optional(),
  /** navigator.connection.effectiveType, e.g. "4g". */
  connection: boundedString(16).optional(),
})

export const stackFrameSchema = z.object({
  filename: url.optional(),
  function: boundedString(256).optional(),
  line: z.number().int().nonnegative().optional(),
  column: z.number().int().nonnegative().optional(),
  /** False for frames from node_modules, browser extensions or third-party origins. */
  inApp: z.boolean().optional(),
})

const baseEventShape = {
  /** Client-generated unique id (UUID v4/v7); used for idempotent ingestion. */
  id: z.uuid(),
  /** Epoch milliseconds when the event happened in the browser. */
  timestamp: z.number().int().positive(),
  environment: environmentSchema,
  release: boundedString(128).optional(),
  /** Random per-tab-session id; never derived from personal data. */
  sessionId: boundedString(64),
  /**
   * Random, non-personal installation id used to count affected users.
   * Only present when `privacy.captureUserContext` is enabled.
   */
  anonymousId: boundedString(64).optional(),
  page: pageContextSchema,
  device: deviceContextSchema,
  tags: z
    .record(boundedString(LIMITS.maxTagKeyLength), boundedString(LIMITS.maxTagValueLength))
    .refine((tags) => Object.keys(tags).length <= LIMITS.maxTagCount, {
      message: `at most ${LIMITS.maxTagCount} tags`,
    })
    .optional(),
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export const errorPayloadSchema = z.object({
  /** Error constructor name, e.g. TypeError. */
  name: boundedString(128),
  message: boundedString(LIMITS.maxMessageLength),
  stack: boundedString(LIMITS.maxStackLength).optional(),
  frames: z.array(stackFrameSchema).max(LIMITS.maxStackFrames).optional(),
  /** How the error reached the SDK. */
  mechanism: z.enum(["onerror", "onunhandledrejection", "error-boundary", "manual", "server"]),
  handled: z.boolean(),
  /** React component stack from an error boundary. */
  componentStack: boundedString(LIMITS.maxComponentStackLength).optional(),
})

export const apiRequestPayloadSchema = z.object({
  method: httpMethodSchema,
  /** Request URL with query values redacted. */
  url,
  /** Normalized endpoint used for grouping, e.g. /api/orders/:id. */
  endpoint: url,
  /** 0 when the request never received a response (network error, abort). */
  status: z.number().int().min(0).max(599),
  durationMs,
  transport: z.enum(["fetch", "xhr"]),
  requestBytes: nonNegative.optional(),
  responseBytes: nonNegative.optional(),
})

export const apiErrorPayloadSchema = apiRequestPayloadSchema.extend({
  errorKind: z.enum(["http", "network", "timeout", "abort"]),
})

export const webVitalPayloadSchema = z.object({
  name: webVitalNameSchema,
  value: nonNegative,
  rating: webVitalRatingSchema,
  delta: z.number().finite(),
  navigationType: boundedString(32).optional(),
  /** CSS selector or resource URL most responsible for the value. */
  attribution: boundedString(512).optional(),
})

export const navigationPayloadSchema = z.object({
  from: url.optional(),
  to: url,
  durationMs: durationMs.optional(),
  kind: z.enum(["initial", "push", "replace", "pop", "reload"]),
})

export const performancePayloadSchema = z.object({
  ttfbMs: durationMs.optional(),
  domContentLoadedMs: durationMs.optional(),
  loadMs: durationMs.optional(),
  transferBytes: nonNegative.optional(),
  resourceCount: z.number().int().nonnegative().optional(),
  longTaskCount: z.number().int().nonnegative().optional(),
})

// ---------------------------------------------------------------------------
// Events — a discriminated union on `type`
// ---------------------------------------------------------------------------

export const errorEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("error"),
  payload: errorPayloadSchema,
})

export const unhandledRejectionEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("unhandled_rejection"),
  payload: errorPayloadSchema,
})

export const apiRequestEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("api_request"),
  payload: apiRequestPayloadSchema,
})

export const apiErrorEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("api_error"),
  payload: apiErrorPayloadSchema,
})

export const webVitalEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("web_vital"),
  payload: webVitalPayloadSchema,
})

export const navigationEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("navigation"),
  payload: navigationPayloadSchema,
})

export const performanceEventSchema = z.object({
  ...baseEventShape,
  type: z.literal("performance"),
  payload: performancePayloadSchema,
})

export const monitoringEventSchema = z.discriminatedUnion("type", [
  errorEventSchema,
  unhandledRejectionEventSchema,
  apiRequestEventSchema,
  apiErrorEventSchema,
  webVitalEventSchema,
  navigationEventSchema,
  performanceEventSchema,
])

// ---------------------------------------------------------------------------
// Ingestion request
// ---------------------------------------------------------------------------

export const sdkInfoSchema = z.object({
  name: boundedString(64),
  version: boundedString(32),
})

/**
 * Body of `POST /api/v1/events`.
 *
 * Events are validated individually by the API so one malformed event
 * cannot cause a whole batch to be dropped; this schema checks the envelope.
 */
export const ingestBatchSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: projectIdSchema,
  sdk: sdkInfoSchema,
  /** Epoch ms when the batch left the browser; lets the server correct clock skew. */
  sentAt: z.number().int().positive(),
  events: z.array(z.unknown()).min(1).max(LIMITS.maxEventsPerBatch),
})

export const ingestResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
})
