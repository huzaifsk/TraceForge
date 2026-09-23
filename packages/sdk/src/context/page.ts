import { LIMITS } from "@traceforge/event-schema/constants"
import type { PageContext } from "@traceforge/event-schema/types"
import { redactUrl } from "@traceforge/shared"

import { truncate } from "../util"

/** Current page, with query values redacted before anything leaves the browser. */
export function getPageContext(route?: string): PageContext {
  const referrer = document.referrer ? redactUrl(document.referrer) : ""
  return {
    url: truncate(redactUrl(location.href), LIMITS.maxUrlLength),
    path: truncate(location.pathname, LIMITS.maxUrlLength),
    ...(route && { route: truncate(route, LIMITS.maxUrlLength) }),
    ...(referrer && { referrer: truncate(referrer, LIMITS.maxUrlLength) }),
  }
}
