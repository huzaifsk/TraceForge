import { safely, uuid } from "../util"

const SESSION_KEY = "traceforge:sid"
const ANONYMOUS_KEY = "traceforge:aid"

/** Read or create a random id in `storage`. Storage can throw (private mode, sandboxed iframes). */
function persistentId(getStorage: () => Storage, key: string): string {
  const existing = safely(() => getStorage().getItem(key))
  if (existing) return existing
  const id = uuid()
  safely(() => getStorage().setItem(key, id))
  return id
}

/** Random per-tab session id; survives reloads, never derived from personal data. */
export const getSessionId = () => persistentId(() => sessionStorage, SESSION_KEY)

/** Random installation id, used only with `privacy.captureUserContext: true`. */
export const getAnonymousId = () => persistentId(() => localStorage, ANONYMOUS_KEY)
