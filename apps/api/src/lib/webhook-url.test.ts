import { describe, expect, it } from "vitest"

import { assertPublicWebhookUrl } from "./webhook-url"

describe("assertPublicWebhookUrl", () => {
  it("accepts a public https URL", () => {
    expect(() => assertPublicWebhookUrl("https://hooks.slack.com/services/x")).not.toThrow()
  })

  it("rejects a non-https URL", () => {
    expect(() => assertPublicWebhookUrl("http://example.com/hook")).toThrow(/https/)
  })

  it("rejects loopback hostnames", () => {
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0"]) {
      expect(() => assertPublicWebhookUrl(`https://${host}/hook`)).toThrow(/localhost/)
    }
  })

  it("rejects a malformed URL", () => {
    expect(() => assertPublicWebhookUrl("not a url")).toThrow()
  })
})
