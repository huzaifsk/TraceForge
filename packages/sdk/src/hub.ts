import type { ResolvedOptions } from "./options"
import type { EventDraft } from "./pipeline"

/** What integrations can see of the client. */
export interface Hub {
  readonly options: ResolvedOptions
  capture(draft: EventDraft): void
  /** True for the SDK's own ingest requests (the recursion guard). */
  isOwnRequest(url: string): boolean
}

/** Restores everything an integration patched or subscribed to. */
export type Teardown = () => void

export type Integration = (hub: Hub) => Teardown
