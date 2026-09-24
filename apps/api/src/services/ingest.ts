import { LIMITS } from "@traceforge/event-schema/constants"
import { monitoringEventSchema } from "@traceforge/event-schema"
import type {
  ApiErrorEvent,
  ErrorEvent,
  MonitoringEvent,
  StackFrame,
  UnhandledRejectionEvent,
} from "@traceforge/event-schema/types"
import {
  computeFingerprint,
  hash53,
  normalizeEndpoint,
  normalizeFilename,
  parseStack,
} from "@traceforge/shared"
import { and, eq, inArray, sql } from "drizzle-orm"

import type { Database } from "../db/client"
import { apiRequests, events, issues, issueUsers, webVitals } from "../db/schema"

/** Clocks within this window of the server are trusted as-is. */
const SKEW_TOLERANCE_MS = 5 * 60_000
/** Accept events at most this old (offline replays) or this far in the future. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60_000
const MAX_FUTURE_MS = 60_000
const MAX_TITLE_LENGTH = 200

type IssueEvent = ErrorEvent | UnhandledRejectionEvent | ApiErrorEvent

/** An accepted event with server-side enrichment applied. */
export interface EnrichedEvent {
  event: MonitoringEvent
  timestamp: Date
  fingerprint: string | null
  issue: { title: string; culprit: string | null } | null
}

export interface ValidationResult {
  valid: MonitoringEvent[]
  rejected: number
}

/**
 * Validate each event independently so one bad event never costs the whole
 * batch. Events over the 64 KB limit are rejected before schema parsing, and
 * repeated ids within the batch are rejected so they cannot double-count.
 */
export function validateEvents(rawEvents: readonly unknown[]): ValidationResult {
  const valid: MonitoringEvent[] = []
  const seenIds = new Set<string>()
  let rejected = 0
  for (const raw of rawEvents) {
    if (Buffer.byteLength(JSON.stringify(raw) ?? "", "utf8") > LIMITS.maxEventBytes) {
      rejected++
      continue
    }
    const result = monitoringEventSchema.safeParse(raw)
    // A repeated id inside one batch is a client bug; keep the first copy only.
    if (!result.success || seenIds.has(result.data.id)) {
      rejected++
      continue
    }
    seenIds.add(result.data.id)
    valid.push(result.data)
  }
  return { valid, rejected }
}

/**
 * Correct for a wrong browser clock (ADR 15). When the batch's `sentAt` is far
 * from the server's receive time, every timestamp in it is shifted by that
 * offset; the result is clamped to a sane window either way.
 */
export function correctTimestamp(timestamp: number, sentAt: number, receivedAt: number): Date {
  const offset = receivedAt - sentAt
  const corrected = Math.abs(offset) > SKEW_TOLERANCE_MS ? timestamp + offset : timestamp
  const clamped = Math.min(
    Math.max(corrected, receivedAt - MAX_EVENT_AGE_MS),
    receivedAt + MAX_FUTURE_MS
  )
  return new Date(clamped)
}

/** Remove query strings and fragments from URLs inside a stack trace (PRD §30). */
export function sanitizeStack(stack: string): string {
  return stack.replace(/(\bhttps?:\/\/[^\s?#)]+)[?#][^\s:)]*/g, "$1")
}

/**
 * Route used for grouping: the router's template when the SDK knows it,
 * otherwise the path with id-like segments collapsed (/orders/123 → /orders/:id).
 */
export const routeOf = (event: MonitoringEvent): string =>
  event.page.route ?? normalizeEndpoint(event.page.path)

const isIssueEvent = (event: MonitoringEvent): event is IssueEvent =>
  event.type === "error" || event.type === "unhandled_rejection" || event.type === "api_error"

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

function culpritOf(frames: readonly StackFrame[]): string | null {
  const frame = frames.find((f) => f.inApp !== false && f.filename) ?? frames[0]
  if (!frame?.filename) return null
  const file = normalizeFilename(frame.filename)
  return frame.function ? `${frame.function} (${file})` : file
}

/** Server-authoritative grouping (ADR 14) plus issue title and culprit. */
export function describeIssue(event: IssueEvent): {
  fingerprint: string
  title: string
  culprit: string | null
} {
  if (event.type === "api_error") {
    const { method, endpoint, status, errorKind } = event.payload
    const outcome = status > 0 ? String(status) : `${errorKind} error`
    return {
      fingerprint: hash53(`api\n${method}\n${endpoint}\n${status > 0 ? status : errorKind}`),
      title: truncate(`${method} ${endpoint} → ${outcome}`, MAX_TITLE_LENGTH),
      culprit: endpoint,
    }
  }

  const { name, message, stack } = event.payload
  const frames = event.payload.frames ?? parseStack(stack)
  return {
    fingerprint: computeFingerprint({ name, message, frames }),
    title: truncate(message ? `${name}: ${message}` : name, MAX_TITLE_LENGTH),
    culprit: culpritOf(frames),
  }
}

/** Apply skew correction, sanitization and fingerprinting to validated events. */
export function enrichEvents(
  valid: readonly MonitoringEvent[],
  sentAt: number,
  receivedAt: number
): EnrichedEvent[] {
  return valid.map((original) => {
    let event = original
    if ((event.type === "error" || event.type === "unhandled_rejection") && event.payload.stack) {
      event = { ...event, payload: { ...event.payload, stack: sanitizeStack(event.payload.stack) } }
    }
    const timestamp = correctTimestamp(event.timestamp, sentAt, receivedAt)
    if (!isIssueEvent(event)) return { event, timestamp, fingerprint: null, issue: null }
    const { fingerprint, title, culprit } = describeIssue(event)
    return { event, timestamp, fingerprint, issue: { title, culprit } }
  })
}

interface IssueAggregate {
  fingerprint: string
  type: IssueEvent["type"]
  title: string
  culprit: string | null
  firstSeen: Date
  lastSeen: Date
  count: number
  userKeys: Set<string>
}

function aggregateIssues(inserted: readonly EnrichedEvent[]): IssueAggregate[] {
  const byFingerprint = new Map<string, IssueAggregate>()
  for (const { event, timestamp, fingerprint, issue } of inserted) {
    if (!fingerprint || !issue) continue
    const userKey = event.anonymousId ?? event.sessionId
    const existing = byFingerprint.get(fingerprint)
    if (existing) {
      existing.count++
      existing.userKeys.add(userKey)
      if (timestamp < existing.firstSeen) existing.firstSeen = timestamp
      if (timestamp > existing.lastSeen) existing.lastSeen = timestamp
    } else {
      byFingerprint.set(fingerprint, {
        fingerprint,
        type: event.type as IssueEvent["type"],
        title: issue.title,
        culprit: issue.culprit,
        firstSeen: timestamp,
        lastSeen: timestamp,
        count: 1,
        userKeys: new Set([userKey]),
      })
    }
  }
  return [...byFingerprint.values()]
}

/** An issue that just appeared, or that regressed (recurred after being resolved). */
export interface AlertEvent {
  kind: "new" | "regression"
  issueId: string
  type: IssueEvent["type"]
  title: string
}

export interface PersistResult {
  /** Events that were new (not duplicates of an earlier delivery). */
  inserted: EnrichedEvent[]
  /** Issue id for every fingerprint touched by this batch. */
  issueIds: Map<string, string>
  /** Issues worth notifying a webhook about, in this batch. */
  alertEvents: AlertEvent[]
}

/**
 * Write a batch in one transaction. Only rows that were actually inserted feed
 * the projections and issue counters, which makes retries and offline replays
 * idempotent end to end (ADR 13).
 */
export async function persistEvents(
  db: Database,
  projectId: string,
  enriched: readonly EnrichedEvent[]
): Promise<PersistResult> {
  const issueIds = new Map<string, string>()
  if (enriched.length === 0) return { inserted: [], issueIds, alertEvents: [] }

  return db.transaction(async (tx) => {
    const insertedIds = await tx
      .insert(events)
      .values(
        enriched.map(({ event, timestamp, fingerprint }) => ({
          id: event.id,
          projectId,
          type: event.type,
          fingerprint,
          environment: event.environment,
          release: event.release ?? null,
          sessionId: event.sessionId,
          anonymousId: event.anonymousId ?? null,
          path: event.page.path,
          route: routeOf(event),
          browser: event.device.browser,
          os: event.device.os,
          deviceType: event.device.deviceType,
          timestamp,
          context: { page: event.page, device: event.device, tags: event.tags ?? {} },
          payload: event.payload,
        }))
      )
      .onConflictDoNothing()
      .returning({ id: events.id })

    const newIds = new Set(insertedIds.map((row) => row.id))
    const inserted = enriched.filter(({ event }) => newIds.has(event.id))
    if (inserted.length === 0) return { inserted, issueIds, alertEvents: [] }

    const apiRows = inserted.flatMap(({ event, timestamp }) =>
      event.type === "api_request" || event.type === "api_error"
        ? [
            {
              id: event.id,
              projectId,
              environment: event.environment,
              method: event.payload.method,
              endpoint: event.payload.endpoint,
              status: event.payload.status,
              durationMs: event.payload.durationMs,
              errorKind: event.type === "api_error" ? event.payload.errorKind : null,
              route: routeOf(event),
              browser: event.device.browser,
              timestamp,
            },
          ]
        : []
    )
    if (apiRows.length > 0) await tx.insert(apiRequests).values(apiRows).onConflictDoNothing()

    const vitalRows = inserted.flatMap(({ event, timestamp }) =>
      event.type === "web_vital"
        ? [
            {
              id: event.id,
              projectId,
              environment: event.environment,
              name: event.payload.name,
              value: event.payload.value,
              rating: event.payload.rating,
              path: event.page.path,
              route: routeOf(event),
              browser: event.device.browser,
              deviceType: event.device.deviceType,
              timestamp,
            },
          ]
        : []
    )
    if (vitalRows.length > 0) await tx.insert(webVitals).values(vitalRows).onConflictDoNothing()

    const aggregates = aggregateIssues(inserted)
    const alertEvents: AlertEvent[] = []
    if (aggregates.length > 0) {
      // Snapshot pre-upsert status so we can tell a brand-new issue from a
      // regression (a resolved issue recurring) after the upsert below.
      const before = await tx
        .select({ fingerprint: issues.fingerprint, status: issues.status })
        .from(issues)
        .where(
          and(
            eq(issues.projectId, projectId),
            inArray(
              issues.fingerprint,
              aggregates.map((a) => a.fingerprint)
            )
          )
        )
      const statusBefore = new Map(before.map((row) => [row.fingerprint, row.status]))

      const upserted = await tx
        .insert(issues)
        .values(
          aggregates.map((a) => ({
            projectId,
            fingerprint: a.fingerprint,
            type: a.type,
            title: a.title,
            culprit: a.culprit,
            firstSeen: a.firstSeen,
            lastSeen: a.lastSeen,
            occurrenceCount: a.count,
          }))
        )
        .onConflictDoUpdate({
          target: [issues.projectId, issues.fingerprint],
          set: {
            firstSeen: sql`least(${issues.firstSeen}, excluded.first_seen)`,
            lastSeen: sql`greatest(${issues.lastSeen}, excluded.last_seen)`,
            occurrenceCount: sql`${issues.occurrenceCount} + excluded.occurrence_count`,
            // A resolved issue that happens again is a regression.
            status: sql`case when ${issues.status} = 'resolved' then 'unresolved'::issue_status else ${issues.status} end`,
          },
        })
        .returning({ id: issues.id, fingerprint: issues.fingerprint })

      for (const row of upserted) {
        issueIds.set(row.fingerprint, row.id)
        const agg = aggregates.find((a) => a.fingerprint === row.fingerprint)
        if (!agg) continue
        const prevStatus = statusBefore.get(row.fingerprint)
        if (prevStatus === undefined)
          alertEvents.push({ kind: "new", issueId: row.id, type: agg.type, title: agg.title })
        else if (prevStatus === "resolved")
          alertEvents.push({
            kind: "regression",
            issueId: row.id,
            type: agg.type,
            title: agg.title,
          })
      }
      const userRows = aggregates.flatMap((a) => {
        const issueId = issueIds.get(a.fingerprint)
        return issueId ? [...a.userKeys].map((userKey) => ({ issueId, userKey })) : []
      })

      const newUsers = await tx
        .insert(issueUsers)
        .values(userRows)
        .onConflictDoNothing()
        .returning({ issueId: issueUsers.issueId })

      const increments = new Map<string, number>()
      for (const { issueId } of newUsers)
        increments.set(issueId, (increments.get(issueId) ?? 0) + 1)
      if (increments.size > 0) {
        const values = sql.join(
          [...increments].map(([id, n]) => sql`(${id}::uuid, ${n}::int)`),
          sql`, `
        )
        await tx.execute(sql`
          update ${issues} set affected_users = ${issues.affectedUsers} + v.n
          from (values ${values}) as v(id, n)
          where ${issues.id} = v.id
        `)
      }
    }

    return { inserted, issueIds, alertEvents }
  })
}
