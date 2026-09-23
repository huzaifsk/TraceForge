/** A deliberately flaky endpoint: `?fail=1` returns a real 500. */
export async function GET(request: Request) {
  const fail = new URL(request.url).searchParams.get("fail") === "1"
  if (fail) {
    return Response.json({ error: "Order service unavailable" }, { status: 500 })
  }
  return Response.json({ orders: [{ id: 42, total: 129.99 }] })
}
