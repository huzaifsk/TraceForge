import { authHeaders } from "@/lib/api"
import { API_URL } from "@/lib/config"

/**
 * Streams the API's SSE feed. It takes precedence over the generic /api
 * rewrite so that when the browser disconnects, the upstream request is
 * aborted cleanly instead of erroring in the proxy.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/v1/projects/[projectId]/stream">
) {
  const { projectId } = await params
  const headers = await authHeaders()
  const lastEventId = request.headers.get("last-event-id")
  if (lastEventId) headers["last-event-id"] = lastEventId

  let upstream: Response
  try {
    upstream = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/stream`, {
      headers,
      signal: request.signal,
      cache: "no-store",
    })
  } catch {
    return new Response(null, { status: request.signal.aborted ? 499 : 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body, { status: upstream.status })
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  })
}
