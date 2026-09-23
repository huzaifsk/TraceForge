import { describe, expect, it } from "vitest"

import { parseDsn } from "./dsn"
import { resolveOptions } from "./options"

const DSN = "https://pk_live_abc123@pulseed.example.com/project/pw_12345abc"

describe("parseDsn", () => {
  it("extracts the ingest URL, project id and public key", () => {
    expect(parseDsn(DSN)).toEqual({
      ingestUrl: "https://pulseed.example.com/api/v1/events",
      projectId: "pw_12345abc",
      publicKey: "pk_live_abc123",
    })
  })

  it("keeps a self-hosted base path", () => {
    expect(parseDsn("http://pk@localhost:4000/pulse/project/pw_12345abc")?.ingestUrl).toBe(
      "http://localhost:4000/pulse/api/v1/events"
    )
  })

  it.each([
    "not a url",
    "https://pulseed.example.com/project/pw_12345abc", // no public key
    "https://pk@pulseed.example.com/project/12345", // bad project id
    "ftp://pk@pulseed.example.com/project/pw_12345abc",
  ])("rejects %s", (dsn) => {
    expect(parseDsn(dsn)).toBeNull()
  })
})

describe("resolveOptions", () => {
  it("applies privacy-first defaults", () => {
    const result = resolveOptions({ dsn: DSN })
    if (!result.ok) throw new Error(result.error)

    expect(result.options.environment).toBe("production")
    expect(result.options.batchSize).toBe(20)
    expect(result.options.flushIntervalMs).toBe(5_000)
    expect(result.options.privacy.captureUserContext).toBe(false)
    expect(result.options.integrations.xhr).toBe(false)
  })

  it("clamps out-of-range numbers", () => {
    const result = resolveOptions({ dsn: DSN, sampleRate: 4, batchSize: 10_000 })
    if (!result.ok) throw new Error(result.error)

    expect(result.options.sampleRate).toBe(1)
    expect(result.options.batchSize).toBe(100)
  })

  it("reports an invalid environment", () => {
    // @ts-expect-error — verifying runtime validation of untyped input
    expect(resolveOptions({ dsn: DSN, environment: "prod" }).ok).toBe(false)
  })
})
