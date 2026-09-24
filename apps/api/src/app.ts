import { STATUS_CODES } from "node:http"

import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import rateLimit from "@fastify/rate-limit"
import { LIMITS } from "@traceforge/event-schema/constants"
import Fastify, { type FastifyError, type FastifyServerOptions } from "fastify"
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod"
import type postgres from "postgres"

import { createAuth } from "./auth/auth"
import { authPlugin } from "./auth/plugin"
import { createDb, type Database } from "./db/client"
import type { Env } from "./env"
import { alertWebhookRoutes } from "./routes/alert-webhooks"
import { analyticsRoutes } from "./routes/analytics"
import { healthRoutes } from "./routes/health"
import { ingestRoutes } from "./routes/ingest"
import { projectRoutes } from "./routes/projects"
import { releaseRoutes } from "./routes/releases"
import { EventBus } from "./services/event-bus"
import { ProjectKeyCache } from "./services/project-keys"

declare module "fastify" {
  interface FastifyInstance {
    config: Env
    db: Database
    sql: postgres.Sql
    projectKeys: ProjectKeyCache
    eventBus: EventBus
  }
}

export interface BuildAppOptions {
  env: Env
  logger?: FastifyServerOptions["logger"]
}

export async function buildApp({ env, logger }: BuildAppOptions) {
  const app = Fastify({
    logger: logger ?? {
      level: env.LOG_LEVEL,
      // Never log credentials that may appear in headers.
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['x-traceforge-key']",
      ],
      ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
    },
    bodyLimit: LIMITS.maxBatchBytes,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const { db, sql } = createDb(env.DATABASE_URL)
  app.decorate("config", env)
  app.decorate("db", db)
  app.decorate("sql", sql)
  app.decorate("projectKeys", new ProjectKeyCache(db))
  app.decorate("eventBus", new EventBus())
  app.addHook("onClose", async () => {
    await sql.end({ timeout: 5 })
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    // Ingestion is called from any customer origin (validated per project);
    // everything else is restricted to the dashboard.
    delegator: (request, callback) => {
      const isIngest = request.url?.startsWith("/api/v1/events") ?? false
      callback(
        null,
        isIngest
          ? { origin: true, credentials: false }
          : { origin: env.DASHBOARD_ORIGINS, credentials: true }
      )
    },
  })
  await app.register(rateLimit, { global: false })

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      // Report which fields failed, never the submitted values.
      const fields = [...new Set(error.validation.map((issue) => issue.instancePath || "(root)"))]
      return reply.code(400).send({
        error: "Bad Request",
        message: `Invalid request: ${fields.slice(0, 5).join(", ")}`,
      })
    }
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled error")
      return reply
        .code(500)
        .send({ error: "Internal Server Error", message: "Something went wrong" })
    }
    return reply.code(statusCode).send({
      error: STATUS_CODES[statusCode] ?? "Error",
      message: error.message,
    })
  })

  await authPlugin(app, { auth: createAuth(db, env) })
  await app.register(healthRoutes)
  await app.register(projectRoutes)
  await app.register(ingestRoutes)
  await app.register(analyticsRoutes)
  await app.register(alertWebhookRoutes)
  await app.register(releaseRoutes)

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
