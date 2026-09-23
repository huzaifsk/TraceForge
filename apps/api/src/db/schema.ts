import {
  ENVIRONMENTS,
  EVENT_TYPES,
  WEB_VITAL_NAMES,
  WEB_VITAL_RATINGS,
} from "@traceforge/event-schema/constants"
import { sql } from "drizzle-orm"
import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "./auth-schema"

export * from "./auth-schema"

// Postgres enums mirror the wire contract so the two can never drift.
export const eventTypeEnum = pgEnum("event_type", EVENT_TYPES)
export const environmentEnum = pgEnum("environment", ENVIRONMENTS)
export const webVitalNameEnum = pgEnum("web_vital_name", WEB_VITAL_NAMES)
export const webVitalRatingEnum = pgEnum("web_vital_rating", WEB_VITAL_RATINGS)
export const platformEnum = pgEnum("platform", ["javascript", "react", "nextjs"])
export const projectStatusEnum = pgEnum("project_status", ["active", "paused"])
export const issueStatusEnum = pgEnum("issue_status", ["unresolved", "resolved", "ignored"])

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    /** Public project id, e.g. tf_12345abc. */
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    platform: platformEnum("platform").notNull().default("react"),
    /** Public ingestion key embedded in the DSN. Rotatable; write-only scope. */
    publicKey: text("public_key").notNull(),
    /** Browser origins allowed to send events. Empty = allow any origin. */
    allowedOrigins: text("allowed_origins")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: projectStatusEnum("status").notNull().default("active"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("projects_public_key_idx").on(t.publicKey),
    index("projects_owner_idx").on(t.ownerId),
  ]
)

// ---------------------------------------------------------------------------
// Raw events — every accepted event, append-only.
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    /** Client-generated UUID; the (project_id, id) primary key makes retried batches idempotent. */
    id: uuid("id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: eventTypeEnum("type").notNull(),
    /** Set for error-like events; links to issues.fingerprint. */
    fingerprint: text("fingerprint"),
    environment: environmentEnum("environment").notNull(),
    release: text("release"),
    sessionId: text("session_id").notNull(),
    anonymousId: text("anonymous_id"),
    path: text("path").notNull(),
    route: text("route"),
    browser: text("browser").notNull(),
    os: text("os").notNull(),
    deviceType: text("device_type").notNull(),
    /** When it happened in the browser (skew-corrected with sentAt). */
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    /** Page, device and tags as sent (already redacted by the SDK). */
    context: jsonb("context").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "events_pkey", columns: [t.projectId, t.id] }),
    index("events_project_time_idx").on(t.projectId, t.timestamp.desc()),
    index("events_project_type_time_idx").on(t.projectId, t.type, t.timestamp.desc()),
    index("events_project_fingerprint_idx").on(t.projectId, t.fingerprint),
  ]
)

// ---------------------------------------------------------------------------
// Issues — errors grouped by fingerprint (PRD §9).
// ---------------------------------------------------------------------------

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    type: eventTypeEnum("type").notNull(),
    /** e.g. "TypeError: Cannot read properties of undefined (reading 'id')" */
    title: text("title").notNull(),
    /** Top in-app frame, e.g. "OrdersTable (app/orders/page.tsx)". */
    culprit: text("culprit"),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
    occurrenceCount: bigint("occurrence_count", { mode: "number" }).notNull().default(0),
    affectedUsers: integer("affected_users").notNull().default(0),
    status: issueStatusEnum("status").notNull().default("unresolved"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("issues_project_fingerprint_idx").on(t.projectId, t.fingerprint),
    index("issues_project_last_seen_idx").on(t.projectId, t.lastSeen.desc()),
  ]
)

// ---------------------------------------------------------------------------
// Typed projections for fast aggregation (PRD §10, §11).
// ---------------------------------------------------------------------------

export const apiRequests = pgTable(
  "api_requests",
  {
    /** Same id as the source event. */
    id: uuid("id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environment: environmentEnum("environment").notNull(),
    method: text("method").notNull(),
    endpoint: text("endpoint").notNull(),
    status: smallint("status").notNull(),
    durationMs: doublePrecision("duration_ms").notNull(),
    /** null for successful requests. */
    errorKind: text("error_kind"),
    route: text("route"),
    browser: text("browser").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ name: "api_requests_pkey", columns: [t.projectId, t.id] }),
    index("api_requests_project_time_idx").on(t.projectId, t.timestamp.desc()),
    index("api_requests_project_endpoint_idx").on(t.projectId, t.endpoint, t.timestamp.desc()),
  ]
)

export const webVitals = pgTable(
  "web_vitals",
  {
    /** Same id as the source event. */
    id: uuid("id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    environment: environmentEnum("environment").notNull(),
    name: webVitalNameEnum("name").notNull(),
    value: doublePrecision("value").notNull(),
    rating: webVitalRatingEnum("rating").notNull(),
    path: text("path").notNull(),
    route: text("route"),
    browser: text("browser").notNull(),
    deviceType: text("device_type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ name: "web_vitals_pkey", columns: [t.projectId, t.id] }),
    index("web_vitals_project_name_time_idx").on(t.projectId, t.name, t.timestamp.desc()),
  ]
)

/**
 * One row per (issue, user key) so "affected users" stays an exact distinct
 * count. The user key is `coalesce(anonymousId, sessionId)`.
 */
export const issueUsers = pgTable(
  "issue_users",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userKey: text("user_key").notNull(),
  },
  (t) => [primaryKey({ name: "issue_users_pkey", columns: [t.issueId, t.userKey] })]
)
