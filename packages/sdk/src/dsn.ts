import { INGEST_PATH } from "@traceforge/event-schema/constants"

export interface ParsedDsn {
  /** Absolute ingestion URL, e.g. https://traceforge.example.com/api/v1/events */
  ingestUrl: string
  projectId: string
  /** Public, rotatable ingestion key. Safe to ship in browser bundles. */
  publicKey: string
}

const PROJECT_ID = /^tf_[a-z0-9]{8,32}$/

/**
 * Parse a project DSN of the form
 *   https://<publicKey>@traceforge.example.com/project/<projectId>
 *
 * The DSN only grants write access to one project's ingestion endpoint — it
 * never carries dashboard credentials.
 */
export function parseDsn(dsn: string): ParsedDsn | null {
  let url: URL
  try {
    url = new URL(dsn)
  } catch {
    return null
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null

  const publicKey = decodeURIComponent(url.username)
  const match = /^\/(?:.*\/)?project\/([^/]+)\/?$/.exec(url.pathname)
  const projectId = match?.[1]

  if (!publicKey || !projectId || !PROJECT_ID.test(projectId)) return null

  // Everything before /project/<id> is the API base path (supports self-hosting under a prefix).
  const basePath = url.pathname.slice(0, url.pathname.lastIndexOf("/project/"))
  return {
    ingestUrl: `${url.protocol}//${url.host}${basePath}${INGEST_PATH}`,
    projectId,
    publicKey,
  }
}
