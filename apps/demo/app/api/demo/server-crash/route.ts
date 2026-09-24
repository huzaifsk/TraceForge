/** Throws unconditionally so Next's onRequestError hook fires (TraceForgeErrorBoundary never sees this — it's server-side). */
export async function GET(): Promise<Response> {
  throw new Error("Order lookup failed: warehouse service unreachable")
}
