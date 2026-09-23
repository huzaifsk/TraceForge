import type { NextConfig } from "next"

/** Where the Pulseed API runs. Server-side only; the browser always talks same-origin. */
const API_URL = process.env.API_URL ?? "http://localhost:4000"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@pulseed/ui"],
  // ADR 9: the browser calls /api/* on the dashboard origin, so session cookies
  // are first-party; Next proxies to the API (SSE streams through).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }]
  },
}

export default nextConfig
