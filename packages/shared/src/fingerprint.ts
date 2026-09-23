import type { StackFrame } from "@traceforge/event-schema/types"

import { hash53 } from "./hash"
import { normalizeFilename } from "./stack"

/** Number of in-app frames that contribute to an error's identity. */
const FINGERPRINT_FRAMES = 5

export interface FingerprintInput {
  name: string
  message: string
  frames?: readonly StackFrame[]
}

/**
 * Strip the volatile parts of an error message (ids, numbers, URLs) so
 * `Order 1234 not found` and `Order 9876 not found` group as one issue.
 * Quoted identifiers such as `(reading 'id')` are kept: they carry meaning.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\d+(\.\d+)?/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Stable grouping key for an error: type + normalized message + the top
 * in-app frames (function + deploy-stable filename). Line and column numbers
 * are excluded on purpose — they shift on every deploy of minified code.
 *
 * The API computes the authoritative fingerprint; the SDK may compute the
 * same value for client-side de-duplication.
 */
export function computeFingerprint({ name, message, frames = [] }: FingerprintInput): string {
  const inApp = frames.filter((frame) => frame.inApp !== false)
  const significant = (inApp.length > 0 ? inApp : frames).slice(0, FINGERPRINT_FRAMES)

  const stackKey = significant
    .map(
      (frame) =>
        `${frame.function ?? "?"}@${frame.filename ? normalizeFilename(frame.filename) : "?"}`
    )
    .join("|")

  return hash53(`${name}\n${normalizeMessage(message)}\n${stackKey}`)
}
