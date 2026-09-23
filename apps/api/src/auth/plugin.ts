import { fromNodeHeaders } from "better-auth/node"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import type { Auth } from "./auth"

type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>

declare module "fastify" {
  interface FastifyInstance {
    auth: Auth
    /** preHandler that rejects requests without a valid dashboard session (401). */
    requireSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    user: Session["user"] | null
  }
}

/**
 * Mounts Better Auth at /api/auth/* by translating Fastify requests into
 * Fetch API requests, and exposes a `requireSession` guard.
 */
export async function authPlugin(app: FastifyInstance, { auth }: { auth: Auth }) {
  app.decorate("auth", auth)
  app.decorateRequest("user", null)

  app.decorate("requireSession", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
    if (!session) {
      return reply.code(401).send({ error: "Unauthorized", message: "Sign in required" })
    }
    request.user = session.user
  })

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, app.config.PUBLIC_API_URL)
      const hasBody = request.method !== "GET" && request.body !== undefined
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          body: hasBody ? JSON.stringify(request.body) : undefined,
        })
      )

      reply.status(response.status)
      response.headers.forEach((value, key) => {
        // Set-Cookie must stay separate headers, never comma-joined.
        if (key !== "set-cookie") reply.header(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length > 0) reply.header("set-cookie", cookies)

      return reply.send(response.body ? await response.text() : null)
    },
  })
}
