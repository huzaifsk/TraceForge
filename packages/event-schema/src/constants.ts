/**
 * Runtime constants shared by the SDK, the ingestion API and the dashboard.
 *
 * This module must stay dependency-free: the SDK imports it at runtime and
 * must never pull Zod into a customer's bundle.
 */

/** Bumped on any breaking change to the wire format. */
export const SCHEMA_VERSION = 1

export const EVENT_TYPES = [
  "error",
  "unhandled_rejection",
  "api_error",
  "api_request",
  "web_vital",
  "navigation",
  "performance",
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const ENVIRONMENTS = ["development", "staging", "production"] as const

export type Environment = (typeof ENVIRONMENTS)[number]

export const WEB_VITAL_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const

export type WebVitalName = (typeof WEB_VITAL_NAMES)[number]

export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const

export type WebVitalRating = (typeof WEB_VITAL_RATINGS)[number]

export const DEVICE_TYPES = ["desktop", "mobile", "tablet", "bot", "unknown"] as const

export type DeviceType = (typeof DEVICE_TYPES)[number]

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

export const LIMITS = {
  /** Hard cap on one serialized event (PRD §30). */
  maxEventBytes: 64 * 1024,
  /** Hard cap on events per ingestion request. */
  maxEventsPerBatch: 100,
  /** Hard cap on a decompressed ingestion request body. */
  maxBatchBytes: 1024 * 1024,
  maxMessageLength: 2_048,
  maxStackLength: 16 * 1024,
  maxStackFrames: 64,
  maxComponentStackLength: 8 * 1024,
  maxUrlLength: 2_048,
  maxTagCount: 32,
  maxTagKeyLength: 64,
  maxTagValueLength: 256,
} as const

/** Defaults the SDK uses when the host app passes no override. */
export const SDK_DEFAULTS = {
  batchSize: 20,
  flushIntervalMs: 5_000,
  maxRetries: 4,
  /** Exponential backoff base: 1s, 2s, 4s, 8s (PRD §16). */
  retryBaseDelayMs: 1_000,
  maxQueueSize: 500,
  /** Keep IndexedDB bounded so an offline tab cannot grow without limit. */
  maxOfflineEvents: 1_000,
  sampleRate: 1,
} as const

/** Header carrying the project's public ingestion key. */
export const INGEST_KEY_HEADER = "x-traceforge-key"

/**
 * Query-string alternative to the header. `navigator.sendBeacon` and
 * `fetch(..., { keepalive: true })` flushes on page unload must be CORS
 * "simple requests" (no custom headers, `text/plain` body), so the SDK sends
 * the key here instead of in a header.
 */
export const INGEST_KEY_QUERY = "key"

/** Versioned ingestion path, relative to the API origin. */
export const INGEST_PATH = "/api/v1/events"
