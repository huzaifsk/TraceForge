import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

import pkg from "./package.json" with { type: "json" }

export default defineConfig({
  define: { __SDK_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: {
      // react.tsx deliberately imports the published package name, not "./index" (see the
      // comment in src/react.tsx), so it isn't resolvable as a plain workspace package from
      // inside its own source tree. Point it at source for tests instead of building first.
      "@traceforge/sdk": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
