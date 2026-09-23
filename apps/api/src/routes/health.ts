import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Liveness: the process is up. Never touches the database. */
  app.get(
    "/health",
    { schema: { response: { 200: z.object({ status: z.literal("ok") }) } } },
    async () => ({ status: "ok" as const })
  )

  /** Readiness: the process can serve traffic (database reachable). */
  app.get(
    "/ready",
    {
      schema: {
        response: {
          200: z.object({ status: z.literal("ready") }),
          503: z.object({ status: z.literal("unavailable") }),
        },
      },
    },
    async (_request, reply) => {
      try {
        await app.sql`select 1`
        return { status: "ready" as const }
      } catch (error) {
        app.log.error({ err: error }, "readiness check failed")
        return reply.code(503).send({ status: "unavailable" as const })
      }
    }
  )
}
