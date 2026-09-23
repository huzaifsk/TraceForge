import "server-only"

import { cookies, headers as requestHeaders } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { z } from "zod"

import { API_URL } from "./config"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/**
 * Headers for server-side API calls: the user's cookies, and their IP so the
 * API's per-IP limits apply per user rather than to the dashboard server.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const [jar, incoming] = await Promise.all([cookies(), requestHeaders()])
  const out: Record<string, string> = {}
  const cookie = jar
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ")
  if (cookie) out.cookie = cookie
  const ip = incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip")
  if (ip) out["x-forwarded-for"] = ip
  return out
}

/**
 * Server-side GET to the API with the user's session, validated against the
 * shared schema. 401 → /login, 404 → the nearest not-found boundary.
 */
export async function apiGet<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  // Read cookies outside the try: cookies() signals dynamic rendering by throwing,
  // and swallowing that would make Next try to prerender the page statically.
  const headers = await authHeaders()
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { headers, cache: "no-store" })
  } catch {
    throw new ApiError(503, "The Pulseed API is unreachable")
  }
  if (response.status === 401) redirect("/login")
  if (response.status === 404) notFound()
  if (!response.ok) throw new ApiError(response.status, `API request failed (${response.status})`)

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) throw new ApiError(502, "The API returned an unexpected response")
  return parsed.data
}

export interface SessionUser {
  id: string
  name: string
  email: string
}

/** The signed-in user, or null. Never throws for "signed out". */
export async function getSessionUser(): Promise<SessionUser | null> {
  const headers = await authHeaders()
  try {
    const response = await fetch(`${API_URL}/api/auth/get-session`, { headers, cache: "no-store" })
    if (!response.ok) return null
    const body = (await response.json()) as { user?: SessionUser } | null
    return body?.user ?? null
  } catch {
    return null
  }
}

/** Redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}
