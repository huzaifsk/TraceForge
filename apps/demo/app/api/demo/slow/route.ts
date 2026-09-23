const MAX_DELAY_MS = 8_000

/** Responds successfully, but only after `?ms=` milliseconds (capped). */
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("ms"))
  const ms = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), MAX_DELAY_MS) : 2_400
  await new Promise((resolve) => setTimeout(resolve, ms))
  return Response.json({ ok: true, delayedMs: ms })
}
