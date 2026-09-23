import type { StackFrame } from "@pulseed/event-schema/types"
import { LIMITS } from "@pulseed/event-schema/constants"

// V8 (Chrome, Edge, Node):  "    at fn (https://x/app.js:10:5)"  or  "    at https://x/app.js:10:5"
const V8_FRAME = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/
// SpiderMonkey / JavaScriptCore (Firefox, Safari):  "fn@https://x/app.js:10:5"
const GECKO_FRAME = /^\s*(?:(.*?)@)?(.+?):(\d+):(\d+)\s*$/

const THIRD_PARTY_PATTERNS = [
  /\/node_modules\//,
  // Framework and bundler runtime chunks (Next.js, webpack, Vite): never the app's own code.
  /\/chunks\/(?:webpack|framework|main|main-app|polyfills|turbopack)[-.]/,
  /\/(?:vendor|vendors)[-.~][\w.-]*\.js/,
  /^(?:chrome|moz|safari(?:-web)?)-extension:\/\//,
  /^webpack-internal:\/\/\/\.\/node_modules\//,
]

/** Parse an `Error#stack` string into structured frames, newest first. */
export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return []

  const frames: StackFrame[] = []
  for (const line of stack.split("\n")) {
    if (frames.length >= LIMITS.maxStackFrames) break

    const match = V8_FRAME.exec(line) ?? (line.includes("@") ? GECKO_FRAME.exec(line) : null)
    if (!match) continue

    const [, fn, filename, lineNo, colNo] = match
    if (!filename) continue

    frames.push({
      function: fn && fn !== "<anonymous>" ? fn : undefined,
      filename,
      line: Number(lineNo),
      column: Number(colNo),
      inApp: !THIRD_PARTY_PATTERNS.some((pattern) => pattern.test(filename)),
    })
  }
  return frames
}

/**
 * Reduce a filename to a deploy-stable form so the same code groups together
 * across releases: drop origin, query and hash, and strip content hashes
 * such as `main.3f2a1b9c.js` or `page-a1b2c3d4e5.js`.
 */
export function normalizeFilename(filename: string): string {
  let path = filename
  try {
    path = new URL(filename).pathname
  } catch {
    path = filename.split(/[?#]/)[0] ?? filename
  }
  return path.replace(/[.-][a-f0-9]{8,}(?=\.[a-z]+$)/i, "")
}
