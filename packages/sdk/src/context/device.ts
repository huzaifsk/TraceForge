import type { DeviceType } from "@traceforge/event-schema/constants"
import type { DeviceContext } from "@traceforge/event-schema/types"

// Order matters: Edge and Opera also claim "Chrome", and Chrome claims "Safari".
const BROWSERS: ReadonlyArray<[name: string, pattern: RegExp]> = [
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /(?:OPR|Opera)\/(\d+)/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
  ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
  ["Safari", /Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/],
]

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed/i

function detectOs(ua: string, touchPoints: number): [os: string, version?: string] {
  let match: RegExpExecArray | null
  if ((match = /Windows NT (\d+)/.exec(ua)))
    return ["Windows", match[1] === "10" ? "10+" : match[1]]
  if ((match = /(?:iPhone|iPad|iPod).*? OS (\d+)/.exec(ua))) return ["iOS", match[1]]
  if ((match = /Android (\d+)/.exec(ua))) return ["Android", match[1]]
  if (/CrOS/.test(ua)) return ["ChromeOS"]
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  if (/Macintosh/.test(ua)) return touchPoints > 1 ? ["iOS"] : ["macOS"]
  if (/Linux/.test(ua)) return ["Linux"]
  return ["Unknown"]
}

function detectDeviceType(ua: string, os: string, touchPoints: number): DeviceType {
  if (BOT.test(ua)) return "bot"
  if (/iPad|Tablet/i.test(ua) || (os === "iOS" && /Macintosh/.test(ua) && touchPoints > 1)) {
    return "tablet"
  }
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "mobile" : "tablet"
  if (/Mobi|iPhone|iPod/.test(ua)) return "mobile"
  return ua ? "desktop" : "unknown"
}

/**
 * Coarse, non-identifying device context from the user agent: browser and OS
 * with major versions only. No UA-parsing library — they cost kilobytes.
 */
export function parseUserAgent(ua: string, touchPoints = 0): DeviceContext {
  const [os, osVersion] = detectOs(ua, touchPoints)
  let browser = "Unknown"
  let browserVersion: string | undefined
  for (const [name, pattern] of BROWSERS) {
    const match = pattern.exec(ua)
    if (match) {
      browser = name
      browserVersion = match[1]
      break
    }
  }
  return {
    browser,
    ...(browserVersion && { browserVersion }),
    os,
    ...(osVersion && { osVersion }),
    deviceType: detectDeviceType(ua, os, touchPoints),
  }
}

interface NetworkInformation {
  effectiveType?: string
}

/** Device context for the current browser; computed once per page. */
export function getDeviceContext(): DeviceContext {
  const nav = navigator as Navigator & { connection?: NetworkInformation }
  const device = parseUserAgent(nav.userAgent ?? "", nav.maxTouchPoints ?? 0)
  const connection = nav.connection?.effectiveType
  return {
    ...device,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    ...(nav.language && { language: nav.language.slice(0, 35) }),
    ...(connection && { connection: connection.slice(0, 16) }),
  }
}
