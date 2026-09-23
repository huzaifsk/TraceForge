import { describe, expect, it } from "vitest"

import { computeFingerprint, normalizeMessage } from "./fingerprint"
import { hash53 } from "./hash"
import { normalizeFilename, parseStack } from "./stack"
import { normalizeEndpoint, redactUrl } from "./url"
import { rateWebVital } from "./web-vitals"

const CHROME_STACK = `TypeError: Cannot read properties of undefined (reading 'id')
    at OrdersTable (https://shop.example.com/_next/static/chunks/app/orders/page-a1b2c3d4e5f6.js:124:18)
    at renderWithHooks (https://shop.example.com/_next/static/chunks/node_modules/react-dom.js:1:1000)
    at https://shop.example.com/_next/static/chunks/main.3f2a1b9c.js:42:7`

const FIREFOX_STACK = `OrdersTable@https://shop.example.com/static/app.js:124:18
@https://shop.example.com/static/app.js:42:7`

describe("hash53", () => {
  it("is deterministic and fixed-width", () => {
    expect(hash53("hello")).toBe(hash53("hello"))
    expect(hash53("hello")).not.toBe(hash53("hello!"))
    expect(hash53("hello")).toHaveLength(14)
  })
})

describe("parseStack", () => {
  it("parses V8 frames and marks node_modules as third-party", () => {
    const frames = parseStack(CHROME_STACK)

    expect(frames).toHaveLength(3)
    expect(frames[0]).toMatchObject({ function: "OrdersTable", line: 124, column: 18, inApp: true })
    expect(frames[1]?.inApp).toBe(false)
    expect(frames[2]?.function).toBeUndefined()
  })

  it("treats framework and bundler runtime chunks as third-party", () => {
    const frames = parseStack(`ChunkLoadError: Loading chunk 412 failed.
    at __webpack_require__.f.j (https://x.test/_next/static/chunks/webpack-8d1e.js:1:3121)
    at hydrate (https://x.test/_next/static/chunks/framework-2c79e2a64abdb08b.js:9:100)
    at loadCheckoutForm (https://x.test/_next/static/chunks/app/checkout/page-a91c.js:18:22)`)

    expect(frames.map((f) => f.inApp)).toEqual([false, false, true])
  })

  it("parses Firefox/Safari frames", () => {
    const frames = parseStack(FIREFOX_STACK)

    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({ function: "OrdersTable", line: 124, column: 18 })
  })

  it("returns an empty list for missing stacks", () => {
    expect(parseStack(undefined)).toEqual([])
  })
})

describe("normalizeFilename", () => {
  it("drops origin, query and content hashes", () => {
    expect(normalizeFilename("https://x.com/_next/static/chunks/main.3f2a1b9c.js?v=2")).toBe(
      "/_next/static/chunks/main.js"
    )
    expect(normalizeFilename("https://x.com/chunks/page-a1b2c3d4e5f6.js")).toBe("/chunks/page.js")
  })
})

describe("computeFingerprint", () => {
  it("groups the same error across deploys (different hashes and line numbers)", () => {
    const a = computeFingerprint({
      name: "TypeError",
      message: "Order 1234 not found",
      frames: parseStack(CHROME_STACK),
    })
    const b = computeFingerprint({
      name: "TypeError",
      message: "Order 9876 not found",
      frames: parseStack(
        CHROME_STACK.replace("a1b2c3d4e5f6", "ffeeddccbbaa").replace(":124:18", ":130:2")
      ),
    })

    expect(a).toBe(b)
  })

  it("separates different error types", () => {
    const frames = parseStack(CHROME_STACK)
    expect(computeFingerprint({ name: "TypeError", message: "x", frames })).not.toBe(
      computeFingerprint({ name: "RangeError", message: "x", frames })
    )
  })

  it("keeps quoted identifiers in messages", () => {
    expect(normalizeMessage("Cannot read properties of undefined (reading 'id')")).toBe(
      "Cannot read properties of undefined (reading 'id')"
    )
  })
})

describe("rateWebVital", () => {
  it.each([
    ["LCP", 2_500, "good"],
    ["LCP", 2_501, "needs-improvement"],
    ["LCP", 4_001, "poor"],
    ["INP", 142, "good"],
    ["CLS", 0.03, "good"],
    ["CLS", 0.3, "poor"],
  ] as const)("%s %d is %s", (name, value, rating) => {
    expect(rateWebVital(name, value)).toBe(rating)
  })
})

describe("redactUrl", () => {
  it("redacts query values, credentials and fragments", () => {
    expect(redactUrl("https://user:pass@x.com/cb?token=abc&state=1#frag")).toBe(
      "https://x.com/cb?token=[redacted]&state=[redacted]"
    )
  })

  it("resolves relative URLs against a base", () => {
    expect(redactUrl("/api/orders?page=2", "https://x.com")).toBe(
      "https://x.com/api/orders?page=[redacted]"
    )
  })
})

describe("normalizeEndpoint", () => {
  it.each([
    ["https://x.com/api/orders/123?page=2", "/api/orders/:id"],
    ["/api/users/0b5a4f8e-6f0e-4c1a-9a57-2d7f0b1c3e4d/profile", "/api/users/:id/profile"],
    ["/api/orders/", "/api/orders"],
    ["/", "/"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeEndpoint(input)).toBe(expected)
  })
})
