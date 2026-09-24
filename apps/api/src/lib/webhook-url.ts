const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"])

/**
 * Proportionate guard for a project owner's own webhook URL (same trust level as
 * allowedOrigins) — https only, literal loopback hostnames rejected. Not a full SSRF
 * fix: no DNS resolution or private-CIDR check, matching env.ts's LOOPBACK_HOSTNAMES bar.
 */
export function assertPublicWebhookUrl(value: string): void {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("Webhook URL must use https")
  if (LOOPBACK_HOSTNAMES.has(url.hostname)) throw new Error("Webhook URL can't target localhost")
}
