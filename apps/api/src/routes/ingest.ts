import { gunzip } from "node:zlib"
import { promisify } from "node:util"

import { ingestBatchSchema } from "@traceforge/event-schema"
import {
  INGEST_KEY_HEADER,
  INGEST_KEY_QUERY,
  INGEST_PATH,
  LIMITS,
} from "@traceforge/event-schema/constants"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"

import { dispatchAlerts } from "../services/alerts"
import { enrichEvents, persistEvents, validateEvents } from "../services/ingest"
import { toLiveEvents } from "../services/live"

const gunzipAsync = promisify(gunzip)

/** Content types the SDK uses: JSON, and text/plain for CORS "simple" requests (ADR 12). */
const ACCEPTED_TYPES = new Set(["application/json", "text/plain", "application/octet-stream"])

const errorResponse = z.object({ error: z.string(), message: z.string() })

const fail = (error: string, message: string) => ({ error, message })

export const ingestRoutes: FastifyPluginAsyncZod = async (app) => {
  // Take the raw bytes: bodies may be gzip-compressed and arrive as text/plain.
  app.removeAllContentTypeParsers()
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body))

  const keyOf = (request: { headers: Record<string, unknown>; query: { key?: string } }) => {
    const header = request.headers[INGEST_KEY_HEADER]
    return (typeof header === "string" ? header : undefined) ?? request.query.key
  }

  app.post(
    INGEST_PATH,
    {
      config: {
        rateLimit: {
          max: app.config.INGEST_RATE_LIMIT_PER_MINUTE,
          timeWindow: "1 minute",
          // Per project key; requests without a key fall back to the client IP.
          keyGenerator: (request) => {
            const header = request.headers[INGEST_KEY_HEADER]
            const query = request.query as { [INGEST_KEY_QUERY]?: unknown }
            const key = typeof header === "string" ? header : query[INGEST_KEY_QUERY]
            return typeof key === "string" ? `key:${key.slice(0, 64)}` : `ip:${request.ip}`
          },
        },
      },
      schema: {
        querystring: z.object({
          [INGEST_KEY_QUERY]: z.string().max(64).optional(),
          enc: z.enum(["gzip"]).optional(),
        }),
        response: {
          202: z.object({ accepted: z.number().int(), rejected: z.number().int() }),
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          413: errorResponse,
          415: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const receivedAt = Date.now()

      const contentType = (request.headers["content-type"] ?? "")
        .split(";")[0]!
        .trim()
        .toLowerCase()
      if (!ACCEPTED_TYPES.has(contentType)) {
        return reply
          .code(415)
          .send(fail("Unsupported Media Type", "Send application/json or text/plain"))
      }

      const raw = request.body
      if (!Buffer.isBuffer(raw) || raw.length === 0) {
        return reply.code(400).send(fail("Bad Request", "Empty body"))
      }

      let text: string
      try {
        text =
          request.query.enc === "gzip"
            ? (await gunzipAsync(raw, { maxOutputLength: LIMITS.maxBatchBytes })).toString("utf8")
            : raw.toString("utf8")
      } catch (error) {
        // Exceeding maxOutputLength means a decompression bomb or an oversized batch.
        if (
          error instanceof RangeError ||
          (error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE"
        ) {
          return reply.code(413).send(fail("Payload Too Large", "Decompressed body is too large"))
        }
        return reply.code(400).send(fail("Bad Request", "Body is not valid gzip"))
      }

      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        return reply.code(400).send(fail("Bad Request", "Body is not valid JSON"))
      }

      const envelope = ingestBatchSchema.safeParse(json)
      if (!envelope.success) {
        const paths = [
          ...new Set(envelope.error.issues.map((issue) => issue.path.join(".") || "(root)")),
        ]
        return reply
          .code(400)
          .send(fail("Bad Request", `Invalid batch: ${paths.slice(0, 5).join(", ")}`))
      }
      const batch = envelope.data

      const key = keyOf(request)
      if (!key) {
        return reply.code(401).send(fail("Unauthorized", "Missing ingestion key"))
      }
      const project = await app.projectKeys.resolve(key)
      // Same response for unknown keys and key/project mismatches: nothing to probe.
      if (!project || project.id !== batch.projectId) {
        return reply.code(401).send(fail("Unauthorized", "Invalid ingestion key"))
      }
      if (project.status !== "active") {
        return reply.code(403).send(fail("Forbidden", "Project is paused"))
      }
      if (project.allowedOrigins.length > 0) {
        const origin = request.headers.origin
        if (!origin || !project.allowedOrigins.includes(origin)) {
          return reply.code(403).send(fail("Forbidden", "Origin not allowed for this project"))
        }
      }

      const { valid, rejected } = validateEvents(batch.events)
      const enriched = enrichEvents(valid, batch.sentAt, receivedAt)
      const { inserted, issueIds, alertEvents } = await persistEvents(app.db, project.id, enriched)
      app.eventBus.publish(project.id, toLiveEvents(inserted, issueIds))
      dispatchAlerts(
        app.db,
        app.log,
        app.config.DASHBOARD_ORIGINS[0],
        project.id,
        alertEvents
      ).catch((err: unknown) => request.log.warn({ err }, "alert dispatch failed"))

      if (rejected > 0)
        request.log.info({ projectId: project.id, rejected }, "rejected invalid events")
      return reply.code(202).send({ accepted: valid.length, rejected })
    }
  )
}
