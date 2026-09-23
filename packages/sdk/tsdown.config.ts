import { defineConfig } from "tsdown"

import pkg from "./package.json" with { type: "json" }

const define = { __SDK_VERSION__: JSON.stringify(pkg.version) }

// Workspace packages are devDependencies, so they are inlined. `onlyImport: []`
// fails the build if the output ever imports a package: the published SDK
// must have zero runtime dependencies.
const deps = { onlyImport: [] }

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    platform: "browser",
    target: "es2020",
    dts: true,
    sourcemap: true,
    clean: true,
    define,
    deps,
  },
  {
    // <script src="https://cdn.jsdelivr.net/npm/@pulseed/sdk"> exposes window.Pulseed
    entry: { pulseed: "src/index.ts" },
    format: ["iife"],
    globalName: "Pulseed",
    platform: "browser",
    target: "es2020",
    minify: true,
    sourcemap: true,
    define,
    deps,
  },
])
