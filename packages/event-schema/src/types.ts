/**
 * Plain TypeScript types for the wire contract.
 *
 * These are hand-written (not `z.infer`) so the SDK's published `.d.ts`
 * files never reference Zod. `schema.ts` asserts at compile time that every
 * Zod schema infers exactly these types, so the two cannot drift.
 */
import type {
  DeviceType,
  Environment,
  HttpMethod,
  SCHEMA_VERSION,
  WebVitalName,
  WebVitalRating,
} from "./constants"

export interface PageContext {
  /** Full URL with query values redacted by the SDK. */
  url: string
  path: string
  /** Route template when the router exposes one, e.g. /orders/[id]. */
  route?: string
  referrer?: string
}

export interface DeviceContext {
  browser: string
  browserVersion?: string
  os: string
  osVersion?: string
  deviceType: DeviceType
  viewport?: { width: number; height: number }
  language?: string
  /** navigator.connection.effectiveType, e.g. "4g". */
  connection?: string
}

export interface StackFrame {
  filename?: string
  function?: string
  line?: number
  column?: number
  /** False for frames from node_modules, browser extensions or third-party origins. */
  inApp?: boolean
}

interface BaseEvent {
  /** Client-generated unique id (UUID); used for idempotent ingestion. */
  id: string
  /** Epoch milliseconds when the event happened in the browser. */
  timestamp: number
  environment: Environment
  release?: string
  /** Random per-tab-session id; never derived from personal data. */
  sessionId: string
  /** Random installation id; only present when `privacy.captureUserContext` is enabled. */
  anonymousId?: string
  page: PageContext
  device: DeviceContext
  tags?: Record<string, string>
}

export type ErrorMechanism = "onerror" | "onunhandledrejection" | "error-boundary" | "manual"

export interface ErrorPayload {
  /** Error constructor name, e.g. TypeError. */
  name: string
  message: string
  stack?: string
  frames?: StackFrame[]
  mechanism: ErrorMechanism
  handled: boolean
  /** React component stack from an error boundary. */
  componentStack?: string
}

export interface ApiRequestPayload {
  method: HttpMethod
  /** Request URL with query values redacted. */
  url: string
  /** Normalized endpoint used for grouping, e.g. /api/orders/:id. */
  endpoint: string
  /** 0 when the request never received a response (network error, abort). */
  status: number
  durationMs: number
  transport: "fetch" | "xhr"
  requestBytes?: number
  responseBytes?: number
}

export type ApiErrorKind = "http" | "network" | "timeout" | "abort"

export interface ApiErrorPayload extends ApiRequestPayload {
  errorKind: ApiErrorKind
}

export interface WebVitalPayload {
  name: WebVitalName
  value: number
  rating: WebVitalRating
  delta: number
  navigationType?: string
  /** CSS selector or resource URL most responsible for the value. */
  attribution?: string
}

export type NavigationKind = "initial" | "push" | "replace" | "pop" | "reload"

export interface NavigationPayload {
  from?: string
  to: string
  durationMs?: number
  kind: NavigationKind
}

export interface PerformancePayload {
  ttfbMs?: number
  domContentLoadedMs?: number
  loadMs?: number
  transferBytes?: number
  resourceCount?: number
  longTaskCount?: number
}

export interface ErrorEvent extends BaseEvent {
  type: "error"
  payload: ErrorPayload
}

export interface UnhandledRejectionEvent extends BaseEvent {
  type: "unhandled_rejection"
  payload: ErrorPayload
}

export interface ApiRequestEvent extends BaseEvent {
  type: "api_request"
  payload: ApiRequestPayload
}

export interface ApiErrorEvent extends BaseEvent {
  type: "api_error"
  payload: ApiErrorPayload
}

export interface WebVitalEvent extends BaseEvent {
  type: "web_vital"
  payload: WebVitalPayload
}

export interface NavigationEvent extends BaseEvent {
  type: "navigation"
  payload: NavigationPayload
}

export interface PerformanceEvent extends BaseEvent {
  type: "performance"
  payload: PerformancePayload
}

export type MonitoringEvent =
  | ErrorEvent
  | UnhandledRejectionEvent
  | ApiRequestEvent
  | ApiErrorEvent
  | WebVitalEvent
  | NavigationEvent
  | PerformanceEvent

/** Narrow a MonitoringEvent by its `type` discriminator. */
export type EventOfType<T extends MonitoringEvent["type"]> = Extract<MonitoringEvent, { type: T }>

export interface SdkInfo {
  name: string
  version: string
}

/** Body of `POST /api/v1/events`. */
export interface IngestBatch {
  schemaVersion: typeof SCHEMA_VERSION
  projectId: string
  sdk: SdkInfo
  /** Epoch ms when the batch left the browser; lets the server correct clock skew. */
  sentAt: number
  events: MonitoringEvent[]
}

export interface IngestResponse {
  accepted: number
  rejected: number
}
