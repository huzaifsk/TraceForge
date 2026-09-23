import { eq } from "drizzle-orm"

import type { Database } from "../db/client"
import { projects } from "../db/schema"

export interface IngestProject {
  id: string
  status: "active" | "paused"
  allowedOrigins: string[]
}

interface Entry {
  project: IngestProject | null
  expiresAt: number
}

/**
 * Resolves public ingestion keys to projects with a bounded TTL cache, so the
 * hot ingest path does not hit Postgres per request. Misses are cached too,
 * which keeps floods of random keys away from the database.
 */
export class ProjectKeyCache {
  private readonly entries = new Map<string, Entry>()

  constructor(
    private readonly db: Database,
    private readonly ttlMs = 60_000,
    private readonly maxEntries = 5_000
  ) {}

  async resolve(publicKey: string): Promise<IngestProject | null> {
    const now = Date.now()
    const cached = this.entries.get(publicKey)
    if (cached && cached.expiresAt > now) return cached.project

    const [row] = await this.db
      .select({
        id: projects.id,
        status: projects.status,
        allowedOrigins: projects.allowedOrigins,
      })
      .from(projects)
      .where(eq(projects.publicKey, publicKey))
      .limit(1)

    const project = row ?? null
    this.entries.delete(publicKey)
    this.entries.set(publicKey, { project, expiresAt: now + this.ttlMs })
    // Map iteration order is insertion order: evict the oldest entry.
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
    return project
  }

  /** Call after rotating, updating or deleting a project. */
  invalidate(publicKey: string): void {
    this.entries.delete(publicKey)
  }
}
