import {
  endpointDetailSchema,
  endpointListSchema,
  endpointQuerySchema,
  issueDetailSchema,
  issueListSchema,
  issuesQuerySchema,
  overviewSchema,
  rangeQuerySchema,
  updateIssueSchema,
  vitalsQuerySchema,
  vitalsSchema,
} from "@traceforge/event-schema"
import { and, eq } from "drizzle-orm"
import type { FastifyReply, FastifyRequest } from "fastify"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"

import { issues, projects } from "../db/schema"
import {
  getEndpoint,
  getIssue,
  getOverview,
  getVitals,
  listEndpoints,
  listIssues,
} from "../services/analytics"

const params = z.object({ projectId: z.string().max(64) })
const errorResponse = z.object({ error: z.string(), message: z.string() })
const notFound = (what: string) => ({ error: "Not Found", message: `${what} not found` })

/** Read-only analytics for one project. Every route is owner-scoped (other users → 404). */
export const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
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

  const base = "/api/v1/projects/:projectId"

  app.get(
    `${base}/overview`,
    {
      schema: {
        params,
        querystring: rangeQuerySchema,
        response: { 200: overviewSchema, 404: errorResponse },
      },
    },
    async (request) =>
      getOverview(app.sql, request.params.projectId, request.query.range, request.query.environment)
  )

  app.get(
    `${base}/issues`,
    {
      schema: {
        params,
        querystring: issuesQuerySchema,
        response: { 200: issueListSchema, 404: errorResponse },
      },
    },
    async (request) => listIssues(app.sql, request.params.projectId, request.query)
  )

  app.get(
    `${base}/issues/:issueId`,
    {
      schema: {
        params: params.extend({ issueId: z.string().max(64) }),
        querystring: rangeQuerySchema,
        response: { 200: issueDetailSchema, 404: errorResponse },
      },
    },
    async (request, reply) => {
      const detail = await getIssue(
        app.sql,
        request.params.projectId,
        request.params.issueId,
        request.query.range,
        request.query.environment
      )
      return detail ?? reply.code(404).send(notFound("Issue"))
    }
  )

  app.patch(
    `${base}/issues/:issueId`,
    {
      schema: {
        params: params.extend({ issueId: z.uuid() }),
        body: updateIssueSchema,
        response: {
          200: z.object({ id: z.string(), status: updateIssueSchema.shape.status }),
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const [row] = await app.db
        .update(issues)
        .set({ status: request.body.status })
        .where(
          and(eq(issues.id, request.params.issueId), eq(issues.projectId, request.params.projectId))
        )
        .returning({ id: issues.id, status: issues.status })
      return row ?? reply.code(404).send(notFound("Issue"))
    }
  )

  app.get(
    `${base}/api-endpoints`,
    {
      schema: {
        params,
        querystring: rangeQuerySchema,
        response: { 200: endpointListSchema, 404: errorResponse },
      },
    },
    async (request) =>
      listEndpoints(
        app.sql,
        request.params.projectId,
        request.query.range,
        request.query.environment
      )
  )

  app.get(
    `${base}/api-endpoints/detail`,
    {
      schema: {
        params,
        querystring: endpointQuerySchema,
        response: { 200: endpointDetailSchema, 404: errorResponse },
      },
    },
    async (request) => getEndpoint(app.sql, request.params.projectId, request.query)
  )

  app.get(
    `${base}/web-vitals`,
    {
      schema: {
        params,
        querystring: vitalsQuerySchema,
        response: { 200: vitalsSchema, 404: errorResponse },
      },
    },
    async (request) => getVitals(app.sql, request.params.projectId, request.query)
  )

  app.get(
    `${base}/stream`,
    {
      schema: {
        params,
        headers: z.object({ "last-event-id": z.string().max(64).optional() }).loose(),
      },
    },
    async (request, reply) => {
      const { projectId } = request.params
      reply.hijack()
      const res = reply.raw
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      })
      // Tell EventSource how long to wait before reconnecting.
      res.write("retry: 3000\n\n")

      const send = (events: readonly { id: string }[]) => {
        for (const event of events) {
          res.write(`id: ${event.id}\nevent: pulse\ndata: ${JSON.stringify(event)}\n\n`)
        }
      }
      const lastEventId = request.headers["last-event-id"]
      if (typeof lastEventId === "string") send(app.eventBus.replayAfter(projectId, lastEventId))

      const unsubscribe = app.eventBus.subscribe(projectId, send)
      const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000)
      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
      request.raw.on("close", cleanup)
      app.addHook("onClose", async () => {
        cleanup()
        res.end()
      })
    }
  )
}
