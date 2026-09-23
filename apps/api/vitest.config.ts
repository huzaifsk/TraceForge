import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    // Integration suites share one database; run files one at a time.
    fileParallelism: false,
    // Sign-ups hash passwords with scrypt (deliberately CPU-heavy). Under a full
    // parallel `pnpm check`, the 5 s default could expire mid-request, and the
    // next test's truncate would then race the still-running sign-up.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://pulseed:pulseed@localhost:5432/pulseed_test",
      PUBLIC_API_URL: "http://localhost:4000",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-000",
      DASHBOARD_ORIGINS: "http://localhost:3000",
    },
  },
})
