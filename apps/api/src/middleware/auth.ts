import type { MiddlewareHandler } from "hono";

/**
 * Shared-token Bearer auth middleware.
 *
 * If VIBESHIFT_API_TOKEN is not set, auth is disabled (dev mode).
 * Otherwise, requests must include `Authorization: Bearer <token>`.
 *
 * Suitable for trusted internal team deployments. For production multi-tenant
 * use, replace with OAuth/OIDC.
 */
export function bearerAuth(): MiddlewareHandler {
  const expected = process.env.VIBESHIFT_API_TOKEN;

  return async (c, next) => {
    if (!expected) {
      await next();
      return;
    }

    const header = c.req.header("authorization") || c.req.header("Authorization");
    if (!header) {
      return c.json({ error: "Authorization header required" }, 401);
    }

    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match || match[1] !== expected) {
      return c.json({ error: "Invalid token" }, 401);
    }

    await next();
  };
}
