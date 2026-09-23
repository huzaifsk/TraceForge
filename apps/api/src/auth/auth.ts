import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import type { Database } from "../db/client"
import * as schema from "../db/schema"
import type { Env } from "../env"

/** Email + password authentication for dashboard users (ADR 10). */
export function createAuth(db: Database, env: Env) {
  return betterAuth({
    appName: "Pulseed",
    baseURL: env.PUBLIC_API_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.DASHBOARD_ORIGINS,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
    },
    rateLimit: {
      // Built-in limiter covers sign-in/sign-up brute force. Off in tests only.
      enabled: env.NODE_ENV !== "test",
      window: 60,
      max: 30,
      customRules: {
        // Session reads are cheap and come from the dashboard server on every page
        // load; limiting them per IP would throttle all users at once.
        "/get-session": false,
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "pulseed",
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "cf-connecting-ip"] },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
