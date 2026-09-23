import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import type { TestProject } from "vitest/node"

declare module "vitest" {
  export interface ProvidedContext {
    dbAvailable: boolean
  }
}

/**
 * Apply migrations to the test database once per run. Locally, a missing
 * database skips the integration suites; in CI it is a hard failure.
 */
export default async function setup(project: TestProject) {
  // globalSetup runs outside the test workers, so `test.env` does not apply here.
  const url =
    process.env.DATABASE_URL ?? "postgres://traceforge:traceforge@localhost:5432/traceforge_test"

  const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 3 })
  try {
    await sql`select 1`
    await migrate(drizzle(sql), {
      migrationsFolder: new URL("../../drizzle", import.meta.url).pathname,
    })
    project.provide("dbAvailable", true)
  } catch (error) {
    if (process.env.CI) throw error
    console.warn(
      `\n⚠ Skipping database integration tests: cannot reach ${new URL(url).host}. Run \`pnpm db:up\`.\n`
    )
    project.provide("dbAvailable", false)
  } finally {
    await sql.end()
  }
}
