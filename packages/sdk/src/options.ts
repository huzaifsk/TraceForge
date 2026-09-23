import type { Environment } from "@pulseed/event-schema/constants"
import type { MonitoringEvent } from "@pulseed/event-schema/types"
import { ENVIRONMENTS, SDK_DEFAULTS } from "@pulseed/event-schema/constants"

import { type ParsedDsn, parseDsn } from "./dsn"

export interface IntegrationOptions {
  /** window "error" events. Default: true. */
  errors?: boolean
  /** window "unhandledrejection" events. Default: true. */
  unhandledRejections?: boolean
  /** Instrument window.fetch. Default: true. */
  fetch?: boolean
  /** Instrument XMLHttpRequest. Default: false. */
  xhr?: boolean
  /** LCP, INP, CLS, FCP, TTFB. Default: true. */
  webVitals?: boolean
  /** SPA route changes via the History API. Default: true. */
  navigation?: boolean
  /** Navigation Timing summary per page load. Default: true. */
  performance?: boolean
}

export interface PrivacyOptions {
  /**
   * Attach a random, non-personal installation id so the dashboard can count
   * affected users. Default: false (PRD §32).
   */
  captureUserContext?: boolean
}

export interface PulseedOptions {
  /** Project DSN from the dashboard: https://<publicKey>@<host>/project/<projectId> */
  dsn: string
  environment?: Environment
  /** Your app's version or commit SHA; enables release comparisons. */
  release?: string
  /** Kill switch. Default: true. */
  enabled?: boolean
  /** Fraction of sessions to monitor, 0–1. Default: 1. */
  sampleRate?: number
  /** Flush when this many events are queued. Default: 20. */
  batchSize?: number
  /** Flush at least this often. Default: 5000ms. */
  flushIntervalMs?: number
  /** Retries before an undeliverable batch is dropped. Default: 4. */
  maxRetries?: number
  integrations?: IntegrationOptions
  privacy?: PrivacyOptions
  /** Error messages to drop, as substrings or regular expressions. */
  ignoreErrors?: ReadonlyArray<string | RegExp>
  /** Request URLs that API monitoring should ignore. The ingest URL is always ignored. */
  ignoreUrls?: ReadonlyArray<string | RegExp>
  /** Static tags attached to every event. */
  tags?: Readonly<Record<string, string>>
  /** Last chance to modify or drop (return null) an event before it is queued. */
  beforeSend?: (event: MonitoringEvent) => MonitoringEvent | null
  /** Log SDK diagnostics to the console. Default: false. */
  debug?: boolean
}

export interface ResolvedOptions {
  dsn: ParsedDsn
  environment: Environment
  release: string | undefined
  enabled: boolean
  sampleRate: number
  batchSize: number
  flushIntervalMs: number
  maxRetries: number
  integrations: Required<IntegrationOptions>
  privacy: Required<PrivacyOptions>
  ignoreErrors: ReadonlyArray<string | RegExp>
  ignoreUrls: ReadonlyArray<string | RegExp>
  tags: Readonly<Record<string, string>>
  beforeSend: PulseedOptions["beforeSend"]
  debug: boolean
}

export type ResolveResult = { ok: true; options: ResolvedOptions } | { ok: false; error: string }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function positiveInt(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return clamp(Math.floor(value), 1, max)
}

/** Validate user options and apply defaults. Never throws. */
export function resolveOptions(input: PulseedOptions): ResolveResult {
  if (!input || typeof input.dsn !== "string") {
    return { ok: false, error: "`dsn` is required." }
  }

  const dsn = parseDsn(input.dsn)
  if (!dsn) {
    return {
      ok: false,
      error: "Invalid `dsn`. Expected https://<publicKey>@<host>/project/<projectId>.",
    }
  }

  const environment = input.environment ?? "production"
  if (!ENVIRONMENTS.includes(environment)) {
    return { ok: false, error: `\`environment\` must be one of: ${ENVIRONMENTS.join(", ")}.` }
  }

  const sampleRate =
    input.sampleRate === undefined || !Number.isFinite(input.sampleRate)
      ? SDK_DEFAULTS.sampleRate
      : clamp(input.sampleRate, 0, 1)

  return {
    ok: true,
    options: {
      dsn,
      environment,
      release: input.release,
      enabled: input.enabled ?? true,
      sampleRate,
      batchSize: positiveInt(input.batchSize, SDK_DEFAULTS.batchSize, 100),
      flushIntervalMs: positiveInt(input.flushIntervalMs, SDK_DEFAULTS.flushIntervalMs, 60_000),
      maxRetries: positiveInt(input.maxRetries, SDK_DEFAULTS.maxRetries, 10),
      integrations: {
        errors: input.integrations?.errors ?? true,
        unhandledRejections: input.integrations?.unhandledRejections ?? true,
        fetch: input.integrations?.fetch ?? true,
        xhr: input.integrations?.xhr ?? false,
        webVitals: input.integrations?.webVitals ?? true,
        navigation: input.integrations?.navigation ?? true,
        performance: input.integrations?.performance ?? true,
      },
      privacy: {
        captureUserContext: input.privacy?.captureUserContext ?? false,
      },
      ignoreErrors: input.ignoreErrors ?? [],
      ignoreUrls: input.ignoreUrls ?? [],
      tags: input.tags ?? {},
      beforeSend: input.beforeSend,
      debug: input.debug ?? false,
    },
  }
}
