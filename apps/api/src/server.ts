import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

import { buildApp } from "./app"
import { loadEnv } from "./env"

try {
  process.loadEnvFile()
} catch {
  // No .env file — rely on the real environment.
}

const env = loadEnv()

if (env.MIGRATE_ON_START) {
  // One short-lived connection, closed before the app opens its pool.
  const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} })
  try {
    // dist/server.mjs → apps/api/drizzle
    await migrate(drizzle(sql), {
      migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
    })
  } finally {
    await sql.end()
  }
}

const app = await buildApp({ env })

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutting down")
  try {
    await app.close()
    process.exit(0)
  } catch (error) {
    app.log.error({ err: error }, "error during shutdown")
    process.exit(1)
  }
}

process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)

try {
  await app.listen({ host: env.HOST, port: env.PORT })
} catch (error) {
  app.log.fatal({ err: error }, "failed to start")
  process.exit(1)
}

// Say plainly when the database is missing, instead of failing on the first request.
try {
  await app.sql`select 1`
} catch {
  app.log.warn(
    "Cannot reach Postgres at DATABASE_URL. Start it with `pnpm db:up`, then `pnpm db:migrate` " +
      "(and `pnpm db:seed` for demo data). Sign-in and ingestion fail until then."
  )
}
