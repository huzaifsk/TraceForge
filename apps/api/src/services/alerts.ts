import { and, eq } from "drizzle-orm"
import type { FastifyBaseLogger } from "fastify"

import type { Database } from "../db/client"
import { alertWebhooks } from "../db/schema"
import type { AlertEvent } from "./ingest"

type AlertWebhookRow = typeof alertWebhooks.$inferSelect

const TIMEOUT_MS = 5_000

const ISSUE_KIND_LABEL: Record<AlertEvent["kind"], string> = {
  new: "New issue",
  regression: "Issue regressed",
}

function genericPayload(projectId: string, event: AlertEvent, url: string) {
  return {
    type: event.kind === "new" ? "issue.new" : "issue.regressed",
    project: { id: projectId },
    issue: { id: event.issueId, type: event.type, title: event.title, url },
  }
}

function slackPayload(event: AlertEvent, url: string) {
  const emoji = event.kind === "new" ? "🆕" : "🔁"
  return { text: `${emoji} ${ISSUE_KIND_LABEL[event.kind]}: *${event.title}*\n${url}` }
}

/** Exported for the "send test" endpoint, which awaits a single delivery directly. */
export async function deliverAlert(
  webhook: AlertWebhookRow,
  event: AlertEvent,
  projectId: string,
  issueUrl: string
): Promise<void> {
  const body =
    webhook.kind === "slack"
      ? slackPayload(event, issueUrl)
      : genericPayload(projectId, event, issueUrl)
  const response = await fetch(webhook.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`webhook responded ${response.status}`)
}

/**
 * Fire-and-forget alert delivery for a project's enabled webhooks. Never awaited by the
 * ingest route: a slow or broken target must not delay the 202 response or SDK retries.
 */
export async function dispatchAlerts(
  db: Database,
  log: FastifyBaseLogger,
  dashboardOrigin: string | undefined,
  projectId: string,
  events: readonly AlertEvent[]
): Promise<void> {
  if (events.length === 0 || !dashboardOrigin) return
  const webhooks = await db
    .select()
    .from(alertWebhooks)
    .where(and(eq(alertWebhooks.projectId, projectId), eq(alertWebhooks.enabled, true)))
  if (webhooks.length === 0) return

  for (const webhook of webhooks) {
    for (const event of events) {
      if (event.kind === "new" && !webhook.notifyOnNewIssue) continue
      if (event.kind === "regression" && !webhook.notifyOnRegression) continue
      const issueUrl = `${dashboardOrigin}/p/${projectId}/issues/${event.issueId}`
      deliverAlert(webhook, event, projectId, issueUrl).catch((err: unknown) =>
        log.warn({ err, webhookId: webhook.id }, "alert webhook delivery failed")
      )
    }
  }
}
