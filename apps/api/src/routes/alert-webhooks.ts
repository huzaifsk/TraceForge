import {
  alertWebhookListSchema,
  alertWebhookSchema,
  createAlertWebhookSchema,
  updateAlertWebhookSchema,
} from "@traceforge/event-schema"
import { and, eq } from "drizzle-orm"
import type { FastifyReply, FastifyRequest } from "fastify"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"

import { alertWebhooks, projects } from "../db/schema"
import { assertPublicWebhookUrl } from "../lib/webhook-url"
import { deliverAlert } from "../services/alerts"

const params = z.object({ projectId: z.string().max(64) })
const webhookParams = params.extend({ id: z.uuid() })
const errorResponse = z.object({ error: z.string(), message: z.string() })
const notFound = (what: string) => ({ error: "Not Found", message: `${what} not found` })

const toResponse = (row: typeof alertWebhooks.$inferSelect) => ({
  id: row.id,
  url: row.url,
  kind: row.kind,
  notifyOnNewIssue: row.notifyOnNewIssue,
  notifyOnRegression: row.notifyOnRegression,
  enabled: row.enabled,
  createdAt: row.createdAt.toISOString(),
})

/** Alert webhook CRUD, owner-scoped exactly like analyticsRoutes (other users → 404). */
export const alertWebhookRoutes: FastifyPluginAsyncZod = async (app) => {
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

  const base = "/api/v1/projects/:projectId/alert-webhooks"

  app.get(
    base,
    { schema: { params, response: { 200: alertWebhookListSchema, 404: errorResponse } } },
    async (request) => {
      const rows = await app.db
        .select()
        .from(alertWebhooks)
        .where(eq(alertWebhooks.projectId, request.params.projectId))
      return { webhooks: rows.map(toResponse) }
    }
  )

  app.post(
    base,
    {
      schema: {
        params,
        body: createAlertWebhookSchema,
        response: { 201: alertWebhookSchema, 400: errorResponse, 404: errorResponse },
      },
    },
    async (request, reply) => {
      try {
        assertPublicWebhookUrl(request.body.url)
      } catch (error) {
        return reply.code(400).send({ error: "Bad Request", message: (error as Error).message })
      }
      const [row] = await app.db
        .insert(alertWebhooks)
        .values({ projectId: request.params.projectId, ...request.body })
        .returning()
      return reply.code(201).send(toResponse(row!))
    }
  )

  app.patch(
    `${base}/:id`,
    {
      schema: {
        params: webhookParams,
        body: updateAlertWebhookSchema,
        response: { 200: alertWebhookSchema, 404: errorResponse },
      },
    },
    async (request, reply) => {
      const [row] = await app.db
        .update(alertWebhooks)
        .set(request.body)
        .where(
          and(
            eq(alertWebhooks.id, request.params.id),
            eq(alertWebhooks.projectId, request.params.projectId)
          )
        )
        .returning()
      return row ? toResponse(row) : reply.code(404).send(notFound("Webhook"))
    }
  )

  app.delete(
    `${base}/:id`,
    { schema: { params: webhookParams, response: { 204: z.null(), 404: errorResponse } } },
    async (request, reply) => {
      const [row] = await app.db
        .delete(alertWebhooks)
        .where(
          and(
            eq(alertWebhooks.id, request.params.id),
            eq(alertWebhooks.projectId, request.params.projectId)
          )
        )
        .returning({ id: alertWebhooks.id })
      if (!row) return reply.code(404).send(notFound("Webhook"))
      return reply.code(204).send(null)
    }
  )

  app.post(
    `${base}/:id/test`,
    {
      schema: {
        params: webhookParams,
        response: {
          200: z.object({ ok: z.literal(true) }),
          404: errorResponse,
          502: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const [webhook] = await app.db
        .select()
        .from(alertWebhooks)
        .where(
          and(
            eq(alertWebhooks.id, request.params.id),
            eq(alertWebhooks.projectId, request.params.projectId)
          )
        )
        .limit(1)
      if (!webhook) return reply.code(404).send(notFound("Webhook"))

      const origin = app.config.DASHBOARD_ORIGINS[0]
      if (!origin) {
        return reply
          .code(502)
          .send({ error: "Bad Gateway", message: "Dashboard origin is not configured" })
      }
      try {
        await deliverAlert(
          webhook,
          { kind: "new", issueId: "test", type: "error", title: "Test alert from TraceForge" },
          request.params.projectId,
          `${origin}/p/${request.params.projectId}/overview`
        )
      } catch (error) {
        return reply.code(502).send({ error: "Bad Gateway", message: (error as Error).message })
      }
      return { ok: true as const }
    }
  )
}
