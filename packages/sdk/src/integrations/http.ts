import { HTTP_METHODS, type HttpMethod, LIMITS } from "@traceforge/event-schema/constants"
import type { ApiErrorKind } from "@traceforge/event-schema/types"
import { normalizeEndpoint, redactUrl } from "@traceforge/shared"

import type { Hub } from "../hub"
import { matches, truncate } from "../util"

export interface RequestOutcome {
  method: string
  url: string
  status: number
  durationMs: number
  transport: "fetch" | "xhr"
  errorKind?: ApiErrorKind
}

/**
 * Framework plumbing, not the app's API: Next.js App Router fetches RSC payloads
 * and prefetches with an `_rsc` query parameter. Recording them would bury real
 * API calls under one "request" per <Link> prefetch.
 */
export function isFrameworkRequest(url: string): boolean {
  try {
    return new URL(url).searchParams.has("_rsc")
  } catch {
    return false
  }
}

const toMethod = (method: string): HttpMethod | null => {
  const upper = method.toUpperCase()
  return (HTTP_METHODS as readonly string[]).includes(upper) ? (upper as HttpMethod) : null
}

/** Shared by the fetch and XHR integrations: classify, redact and capture. */
export function captureRequest(hub: Hub, outcome: RequestOutcome): void {
  const method = toMethod(outcome.method)
  if (!method) return

  let absolute: string
  try {
    absolute = new URL(outcome.url, location.href).href
  } catch {
    return
  }
  if (hub.isOwnRequest(absolute) || matches(absolute, hub.options.ignoreUrls)) return
  if (isFrameworkRequest(absolute)) return

  const errorKind: ApiErrorKind | undefined =
    outcome.errorKind ?? (outcome.status >= 400 ? "http" : undefined)
  const base = {
    method,
    url: truncate(redactUrl(absolute), LIMITS.maxUrlLength),
    endpoint: truncate(normalizeEndpoint(absolute), LIMITS.maxUrlLength),
    status: outcome.status,
    durationMs: Math.max(0, Math.min(600_000, Math.round(outcome.durationMs))),
    transport: outcome.transport,
  }

  if (errorKind) hub.capture({ type: "api_error", payload: { ...base, errorKind } })
  else hub.capture({ type: "api_request", payload: base })
}

function errorKindOf(error: unknown): ApiErrorKind {
  const name = (error as { name?: unknown } | null)?.name
  if (name === "AbortError") return "abort"
  if (name === "TimeoutError") return "timeout"
  return "network"
}

/**
 * Wraps window.fetch. The wrapper never touches bodies or headers, returns
 * the original promise's result untouched, and re-throws the original error.
 */
export function fetchIntegration(nativeFetch: typeof fetch): (hub: Hub) => () => void {
  return (hub) => {
    const wrapped = function fetch(
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const start = performance.now()
      let method = "GET"
      let url = ""
      try {
        method = init?.method ?? (input instanceof Request ? input.method : "GET")
        url = input instanceof Request ? input.url : String(input)
      } catch {
        // Unusual input: still perform the request, just don't record it.
      }

      const promise = nativeFetch.call(this ?? window, input, init)
      promise.then(
        (response) => {
          try {
            captureRequest(hub, {
              method,
              url,
              status: response.status,
              durationMs: performance.now() - start,
              transport: "fetch",
            })
          } catch {
            /* never break the host */
          }
        },
        (error: unknown) => {
          try {
            captureRequest(hub, {
              method,
              url,
              status: 0,
              durationMs: performance.now() - start,
              transport: "fetch",
              errorKind: errorKindOf(error),
            })
          } catch {
            /* never break the host */
          }
        }
      )
      return promise
    }

    window.fetch = wrapped as typeof fetch
    return () => {
      if (window.fetch === wrapped) window.fetch = nativeFetch
    }
  }
}

const XHR_STATE = Symbol("traceforge.xhr")

interface XhrState {
  method: string
  url: string
  start: number
}

/** Opt-in XMLHttpRequest instrumentation, same rules as fetch. */
export const xhrIntegration = (hub: Hub): (() => void) => {
  const proto = XMLHttpRequest.prototype
  const nativeOpen = proto.open
  const nativeSend = proto.send

  proto.open = function open(
    this: XMLHttpRequest & { [XHR_STATE]?: XhrState },
    ...args: unknown[]
  ) {
    try {
      this[XHR_STATE] = { method: String(args[0]), url: String(args[1]), start: 0 }
    } catch {
      /* ignore */
    }
    return (nativeOpen as (...a: unknown[]) => void).apply(this, args)
  } as typeof proto.open

  proto.send = function send(this: XMLHttpRequest & { [XHR_STATE]?: XhrState }, body) {
    const state = this[XHR_STATE]
    if (state) {
      state.start = performance.now()
      let errorKind: ApiErrorKind | undefined
      this.addEventListener("abort", () => (errorKind = "abort"))
      this.addEventListener("timeout", () => (errorKind = "timeout"))
      this.addEventListener("error", () => (errorKind = "network"))
      this.addEventListener("loadend", () => {
        try {
          captureRequest(hub, {
            method: state.method,
            url: state.url,
            status: errorKind ? 0 : this.status,
            durationMs: performance.now() - state.start,
            transport: "xhr",
            ...(errorKind && { errorKind }),
          })
        } catch {
          /* never break the host */
        }
      })
    }
    return nativeSend.call(this, body)
  }

  return () => {
    proto.open = nativeOpen
    proto.send = nativeSend
  }
}
