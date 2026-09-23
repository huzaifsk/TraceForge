import { describe, expect, it } from "vitest"

import { parseUserAgent } from "./device"

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
  edgeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  ipadOs:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  opera:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/120.0.0.0",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
}

describe("parseUserAgent", () => {
  it.each([
    [
      UA.chromeMac,
      0,
      { browser: "Chrome", browserVersion: "153", os: "macOS", deviceType: "desktop" },
    ],
    [
      UA.edgeWin,
      0,
      { browser: "Edge", browserVersion: "140", os: "Windows", deviceType: "desktop" },
    ],
    [
      UA.safariIphone,
      5,
      { browser: "Safari", browserVersion: "18", os: "iOS", deviceType: "mobile" },
    ],
    [UA.firefoxLinux, 0, { browser: "Firefox", os: "Linux", deviceType: "desktop" }],
    [
      UA.chromeAndroid,
      5,
      { browser: "Chrome", os: "Android", osVersion: "14", deviceType: "mobile" },
    ],
    [UA.androidTablet, 5, { os: "Android", deviceType: "tablet" }],
    [UA.ipadOs, 5, { browser: "Safari", os: "iOS", deviceType: "tablet" }],
    [UA.opera, 0, { browser: "Opera", deviceType: "desktop" }],
    [UA.googlebot, 0, { deviceType: "bot" }],
  ])("%s", (ua, touchPoints, expected) => {
    expect(parseUserAgent(ua, touchPoints)).toMatchObject(expected)
  })

  it("handles an empty user agent", () => {
    expect(parseUserAgent("")).toEqual({ browser: "Unknown", os: "Unknown", deviceType: "unknown" })
  })
})
