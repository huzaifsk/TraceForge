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
    // <script src="https://cdn.jsdelivr.net/npm/@traceforge/sdk"> exposes window.TraceForge
    entry: { traceforge: "src/index.ts" },
    format: ["iife"],
    globalName: "TraceForge",
    platform: "browser",
    target: "es2020",
    minify: true,
    sourcemap: true,
    define,
    deps,
  },
  {
    // A separate entry so the core bundle above never imports React. React is an
    // optional peer dependency here only, not part of the zero-dep guarantee.
    entry: ["src/react.tsx"],
    format: ["esm", "cjs"],
    platform: "browser",
    target: "es2020",
    dts: true,
    sourcemap: true,
    define,
    // "@traceforge/sdk" must stay external (see the comment in src/react.tsx) so it
    // resolves to the same module the host app's own `init()` call runs against.
    deps: { onlyImport: ["react", "@traceforge/sdk"] },
  },
  {
    // Server-side only (Next.js instrumentation.ts). No shared state with the browser
    // entries — server and browser are separate runtimes in Next.js — so this stays
    // zero-dep like core, no bare self-import needed.
    entry: ["src/next.ts"],
    format: ["esm", "cjs"],
    platform: "neutral", // no window/document; must also run on Next's Edge runtime
    target: "es2020",
    dts: true,
    sourcemap: true,
    define,
    deps,
  },
])
