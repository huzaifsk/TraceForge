import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    // Neon/Supabase poolers (PgBouncer, transaction mode) do not support prepared statements.
    prepare: false,
  })
  return { db: drizzle(sql, { schema }), sql }
}

export type Database = ReturnType<typeof createDb>["db"]
