import { z } from "zod"

const csv = z.string().transform((value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
)

/**
 * Origins must include the scheme (`https://host`, no path or trailing
 * slash) so they compare equal to a browser's `Origin` header. A bare host
 * like `thetraceforge.vercel.app` never matches and silently rejects every
 * sign-in with INVALID_ORIGIN.
 */
const origin = z.string().refine((value) => {
  try {
    const url = new URL(value)
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value
  } catch {
    return false
  }
}, "must be an origin like https://example.com (scheme required, no path or trailing slash)")

/**
 * The dev default. Any loopback PUBLIC_API_URL that survives into a
 * production boot means every project created on that deploy gets handed a
 * DSN pointing at "localhost" — it is baked verbatim into `projects.dsn` and
 * shown on the onboarding screen, so the break is silent until someone
 * actually tries to use the SDK. Checked by hostname, not by string equality
 * against the one default value, so a developer's own differently-ported
 * loopback URL (e.g. from a local .env) is caught too.
 */
const LOCALHOST_API_URL = "http://localhost:4000"
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"])
const isLoopback = (url: string) => {
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(url).hostname)
  } catch {
    return false
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.url(),
    /** Public base URL of this API, as browsers and SDKs reach it. Used in DSNs and auth. */
    PUBLIC_API_URL: z.url().default(LOCALHOST_API_URL),
    /** Signs session cookies. Generate with `openssl rand -base64 32`. */
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    DASHBOARD_ORIGINS: csv.pipe(z.array(origin)).default(["http://localhost:3000"]),
    INGEST_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(600),
    /** Apply pending migrations at startup (for hosts without a pre-deploy step, e.g. Render free). */
    MIGRATE_ON_START: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && isLoopback(env.PUBLIC_API_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["PUBLIC_API_URL"],
        message: `must be a real public URL in production — "${env.PUBLIC_API_URL}" is a loopback address, baked into every project's DSN, and only works on this machine`,
      })
    }
  })

export type Env = z.infer<typeof envSchema>

/** Parse and validate the process environment. Fails fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
    )
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`)
  }
  return result.data
}
