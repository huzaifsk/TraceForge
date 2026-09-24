import { afterEach, describe, expect, it, vi } from "vitest"

import { withTraceForge } from "./next"

const DSN = "https://pk_test@traceforge.example.com/project/tf_abc12345"
const REQUEST = { path: "/orders/42", method: "GET", headers: {} }
const CONTEXT = {
  routerKind: "App Router" as const,
  routePath: "/orders/[id]",
  routeType: "render",
}

describe("withTraceForge", () => {
  afterEach(() => vi.restoreAllMocks())

  it("posts an error event built from the request and context", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null))
    const onRequestError = withTraceForge({ dsn: DSN, environment: "production", release: "v1" })

    await onRequestError(new Error("boom"), REQUEST, CONTEXT)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://traceforge.example.com/api/v1/events")
    expect((init?.headers as Record<string, string>)["x-traceforge-key"]).toBe("pk_test")
    const body = JSON.parse(String(init?.body)) as {
      projectId: string
      events: [
        {
          environment: string
          release?: string
          page: { path: string; route: string }
          payload: { name: string; message: string; mechanism: string; handled: boolean }
        },
      ]
    }
    expect(body.projectId).toBe("tf_abc12345")
    const [event] = body.events
    expect(event.environment).toBe("production")
    expect(event.release).toBe("v1")
    expect(event.page.path).toBe("/orders/42")
    expect(event.page.route).toBe("/orders/[id]")
    expect(event.payload).toMatchObject({
      name: "Error",
      message: "boom",
      mechanism: "server",
      handled: true,
    })
  })

  it("truncates an oversized stack", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null))
    const onRequestError = withTraceForge({ dsn: DSN })
    const error = new Error("boom")
    error.stack = "x".repeat(20_000)

    await onRequestError(error, REQUEST, CONTEXT)

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(String(init?.body)) as { events: [{ payload: { stack?: string } }] }
    expect(body.events[0]?.payload.stack?.length).toBeLessThanOrEqual(16 * 1024)
  })

  it("handles a thrown non-Error value", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null))
    const onRequestError = withTraceForge({ dsn: DSN })

    await onRequestError("just a string", REQUEST, CONTEXT)

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(String(init?.body)) as { events: [{ payload: { message: string } }] }
    expect(body.events[0]?.payload.message).toBe("just a string")
  })

  it("never throws even when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"))
    const onRequestError = withTraceForge({ dsn: DSN })

    await expect(onRequestError(new Error("boom"), REQUEST, CONTEXT)).resolves.toBeUndefined()
  })

  it("no-ops silently on an invalid DSN", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null))
    const onRequestError = withTraceForge({ dsn: "not-a-dsn" })

    await onRequestError(new Error("boom"), REQUEST, CONTEXT)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
