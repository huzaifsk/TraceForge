import { projectSchema } from "@traceforge/event-schema"
import { and, count, desc, eq, getTableColumns, sql } from "drizzle-orm"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"

import { projects } from "../db/schema"
import { buildDsn } from "../lib/dsn"
import { generateProjectId, generatePublicKey } from "../lib/ids"

/** A user may own this many projects; keeps free-tier storage abuse bounded. */
const MAX_PROJECTS_PER_USER = 20

const origin = z
  .string()
  .max(255)
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value
      } catch {
        return false
      }
    },
    { message: "must be an origin like https://app.example.com (no path or trailing slash)" }
  )

const platform = z.enum(["javascript", "react", "nextjs"])

const projectResponse = projectSchema

const createBody = z.object({
  name: z.string().trim().min(1).max(64),
  platform: platform.default("react"),
  allowedOrigins: z.array(origin).max(50).default([]),
})

const updateBody = z
  .object({
    name: z.string().trim().min(1).max(64),
    platform,
    status: z.enum(["active", "paused"]),
    allowedOrigins: z.array(origin).max(50),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "nothing to update" })

const params = z.object({ projectId: z.string().max(64) })
const errorResponse = z.object({ error: z.string(), message: z.string() })

type ProjectRow = typeof projects.$inferSelect & { lastEventAt?: Date | string | null }

/** Newest event time; the (project_id, timestamp desc) index makes this an index lookup. */
const lastEventAt = sql<string | null>`(
  select max(e.timestamp) from events e where e.project_id = ${projects}.id
)`.as("last_event_at")

export const projectRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", app.requireSession)

  const toResponse = (row: ProjectRow) => ({
    id: row.id,
    name: row.name,
    platform: row.platform,
    status: row.status,
    allowedOrigins: row.allowedOrigins,
    publicKey: row.publicKey,
    dsn: buildDsn(app.config.PUBLIC_API_URL, row.publicKey, row.id),
    createdAt: row.createdAt.toISOString(),
    lastEventAt: row.lastEventAt ? new Date(row.lastEventAt).toISOString() : null,
  })

  /** Owner-scoped lookup. Other users' projects are indistinguishable from missing ones. */
  const findOwned = async (projectId: string, ownerId: string) => {
    const [row] = await app.db
      .select({ ...getTableColumns(projects), lastEventAt })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .limit(1)
    return row
  }

  const notFound = { error: "Not Found", message: "Project not found" }

  app.get(
    "/api/v1/projects",
    { schema: { response: { 200: z.object({ projects: z.array(projectResponse) }) } } },
    async (request) => {
      const rows = await app.db
        .select({ ...getTableColumns(projects), lastEventAt })
        .from(projects)
        .where(eq(projects.ownerId, request.user!.id))
        .orderBy(desc(projects.createdAt))
      return { projects: rows.map(toResponse) }
    }
  )

  app.post(
    "/api/v1/projects",
    {
      schema: {
        body: createBody,
        response: { 201: projectResponse, 409: errorResponse },
      },
    },
    async (request, reply) => {
      const ownerId = request.user!.id
      const [owned] = await app.db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.ownerId, ownerId))
      if ((owned?.value ?? 0) >= MAX_PROJECTS_PER_USER) {
        return reply.code(409).send({
          error: "Conflict",
          message: `You can own at most ${MAX_PROJECTS_PER_USER} projects`,
        })
      }

      const [row] = await app.db
        .insert(projects)
        .values({
          id: generateProjectId(),
          publicKey: generatePublicKey(),
          ownerId,
          name: request.body.name,
          platform: request.body.platform,
          allowedOrigins: request.body.allowedOrigins,
        })
        .returning()
      return reply.code(201).send(toResponse(row!))
    }
  )

  app.get(
    "/api/v1/projects/:projectId",
    { schema: { params, response: { 200: projectResponse, 404: errorResponse } } },
    async (request, reply) => {
      const row = await findOwned(request.params.projectId, request.user!.id)
      return row ? toResponse(row) : reply.code(404).send(notFound)
    }
  )

  app.patch(
    "/api/v1/projects/:projectId",
    {
      schema: {
        params,
        body: updateBody,
        response: { 200: projectResponse, 404: errorResponse },
      },
    },
    async (request, reply) => {
      const [row] = await app.db
        .update(projects)
        .set(request.body)
        .where(
          and(eq(projects.id, request.params.projectId), eq(projects.ownerId, request.user!.id))
        )
        .returning()
      if (!row) return reply.code(404).send(notFound)
      app.projectKeys.invalidate(row.publicKey)
      return toResponse(row)
    }
  )

  app.post(
    "/api/v1/projects/:projectId/rotate-key",
    { schema: { params, response: { 200: projectResponse, 404: errorResponse } } },
    async (request, reply) => {
      const existing = await findOwned(request.params.projectId, request.user!.id)
      if (!existing) return reply.code(404).send(notFound)

      const [row] = await app.db
        .update(projects)
        .set({ publicKey: generatePublicKey() })
        .where(eq(projects.id, existing.id))
        .returning()
      // The old key must stop working immediately, not after the cache TTL.
      app.projectKeys.invalidate(existing.publicKey)
      return toResponse(row!)
    }
  )

  app.delete(
    "/api/v1/projects/:projectId",
    { schema: { params, response: { 204: z.null(), 404: errorResponse } } },
    async (request, reply) => {
      const [row] = await app.db
        .delete(projects)
        .where(
          and(eq(projects.id, request.params.projectId), eq(projects.ownerId, request.user!.id))
        )
        .returning({ publicKey: projects.publicKey })
      if (!row) return reply.code(404).send(notFound)
      app.projectKeys.invalidate(row.publicKey)
      return reply.code(204).send(null)
    }
  )
}
