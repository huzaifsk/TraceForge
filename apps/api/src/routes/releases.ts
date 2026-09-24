import {
  createReleaseSchema,
  releaseDetailSchema,
  releaseListSchema,
  releaseSchema,
} from "@traceforge/event-schema"
import { and, desc, eq } from "drizzle-orm"
import type { FastifyReply, FastifyRequest } from "fastify"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"

import { projects, releases } from "../db/schema"
import { getReleaseStats } from "../services/analytics"

const params = z.object({ projectId: z.string().max(64) })
const releaseParams = params.extend({ id: z.uuid() })
const errorResponse = z.object({ error: z.string(), message: z.string() })
const notFound = (what: string) => ({ error: "Not Found", message: `${what} not found` })

const UNIQUE_VIOLATION = "23505"

const toResponse = (row: typeof releases.$inferSelect) => ({
  id: row.id,
  version: row.version,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
})

/** Release CRUD, owner-scoped exactly like alertWebhookRoutes (other users → 404). */
export const releaseRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", app.requireSession)
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId?: string }
    if (!projectId || !request.user) return
    const [owned] = await app.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, request.user.id)))
      .limit(1)
    if (!owned) return reply.code(404).send(notFound("Project"))
  })

  const base = "/api/v1/projects/:projectId/releases"

  app.get(
    base,
    { schema: { params, response: { 200: releaseListSchema, 404: errorResponse } } },
    async (request) => {
      const rows = await app.db
        .select()
        .from(releases)
        .where(eq(releases.projectId, request.params.projectId))
        .orderBy(desc(releases.createdAt))
      return { releases: rows.map(toResponse) }
    }
  )

  app.post(
    base,
    {
      schema: {
        params,
        body: createReleaseSchema,
        response: { 201: releaseSchema, 404: errorResponse, 409: errorResponse },
      },
    },
    async (request, reply) => {
      try {
        const [row] = await app.db
          .insert(releases)
          .values({ projectId: request.params.projectId, ...request.body })
          .returning()
        return reply.code(201).send(toResponse(row!))
      } catch (error) {
        const cause = (error as { cause?: { code?: string } }).cause
        if (cause?.code === UNIQUE_VIOLATION) {
          return reply
            .code(409)
            .send({ error: "Conflict", message: "A release with this version already exists" })
        }
        throw error
      }
    }
  )

  app.get(
    `${base}/:id`,
    {
      schema: {
        params: releaseParams,
        response: { 200: releaseDetailSchema, 404: errorResponse },
      },
    },
    async (request, reply) => {
      const [row] = await app.db
        .select()
        .from(releases)
        .where(
          and(eq(releases.id, request.params.id), eq(releases.projectId, request.params.projectId))
        )
        .limit(1)
      if (!row) return reply.code(404).send(notFound("Release"))
      const stats = await getReleaseStats(app.sql, request.params.projectId, row.version)
      return { release: toResponse(row), ...stats }
    }
  )

  app.delete(
    `${base}/:id`,
    { schema: { params: releaseParams, response: { 204: z.null(), 404: errorResponse } } },
    async (request, reply) => {
      const [row] = await app.db
        .delete(releases)
        .where(
          and(eq(releases.id, request.params.id), eq(releases.projectId, request.params.projectId))
        )
        .returning({ id: releases.id })
      if (!row) return reply.code(404).send(notFound("Release"))
      return reply.code(204).send(null)
    }
  )
}
