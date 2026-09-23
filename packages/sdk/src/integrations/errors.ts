import type { ErrorMechanism, ErrorPayload } from "@pulseed/event-schema/types"

import type { Integration } from "../hub"
import { describeValue } from "../util"

/** Turn any thrown or rejected value into an error payload. */
export function toErrorPayload(
  value: unknown,
  mechanism: ErrorMechanism,
  handled: boolean,
  fallbackName = "Error"
): ErrorPayload {
  if (value instanceof Error || (value && typeof value === "object" && "message" in value)) {
    const error = value as Error
    return {
      name: typeof error.name === "string" && error.name ? error.name : fallbackName,
      message: typeof error.message === "string" ? error.message : describeValue(error.message),
      ...(typeof error.stack === "string" && { stack: error.stack }),
      mechanism,
      handled,
    }
  }
  return { name: fallbackName, message: describeValue(value), mechanism, handled }
}

/** Uncaught errors, via a capture-phase listener (never by assigning window.onerror). */
export const errorsIntegration: Integration = (hub) => {
  const onError = (event: ErrorEvent) => {
    // Failed <img>/<script>/<link> loads also dispatch "error" in the capture phase, with the
    // element as target. They are not JS errors. (Comparing to `window` breaks across realms.)
    if ((event.target as Node | null)?.nodeType === 1) return

    let payload: ErrorPayload
    if (event.error != null) {
      payload = toErrorPayload(event.error, "onerror", false)
    } else if (event.message === "Script error." || event.message === "Script error") {
      // Cross-origin script without crossorigin="anonymous": the browser hides the details.
      payload = {
        name: "CrossOriginScriptError",
        message:
          'Script error. Add crossorigin="anonymous" to third-party <script> tags to see details.',
        mechanism: "onerror",
        handled: false,
      }
    } else {
      payload = {
        name: "Error",
        message: event.message || "Unknown error",
        ...(event.filename && {
          stack: `Error: ${event.message}\n    at ${event.filename}:${event.lineno}:${event.colno}`,
        }),
        mechanism: "onerror",
        handled: false,
      }
    }
    hub.capture({ type: "error", payload })
  }

  window.addEventListener("error", onError, true)
  return () => window.removeEventListener("error", onError, true)
}

/** Promise rejections nobody handled. */
export const rejectionsIntegration: Integration = (hub) => {
  const onRejection = (event: PromiseRejectionEvent) => {
    hub.capture({
      type: "unhandled_rejection",
      payload: toErrorPayload(event.reason, "onunhandledrejection", false, "UnhandledRejection"),
    })
  }
  window.addEventListener("unhandledrejection", onRejection)
  return () => window.removeEventListener("unhandledrejection", onRejection)
}
