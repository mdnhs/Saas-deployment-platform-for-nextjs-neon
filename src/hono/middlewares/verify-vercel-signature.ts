import { createMiddleware } from "hono/factory";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/server/security/logger";

/**
 * Verify the HMAC-SHA1 signature Vercel attaches to outbound webhooks.
 * Invariant #7: unsigned or mis-signed requests are rejected before any handler
 * runs. Verification is done over the RAW body — we stash it on `c.var.rawBody`
 * for the downstream handler.
 *
 * Vercel's docs: header `x-vercel-signature`, value `sha1=<hex>`.
 * `VERCEL_WEBHOOK_SECRET` is the shared secret configured in the Vercel
 * integration / project settings.
 */
export const verifyVercelSignature = createMiddleware<{
  Variables: { rawBody: string };
}>(async (c, next) => {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("vercel webhook hit but VERCEL_WEBHOOK_SECRET is unset");
    return c.json({ error: "webhook not configured" }, 500);
  }

  const signature = c.req.header("x-vercel-signature");
  if (!signature) {
    logger.warn("vercel webhook missing x-vercel-signature header");
    return c.json({ error: "missing signature" }, 401);
  }

  const rawBody = await c.req.text();

  const expectedHex = createHmac("sha1", secret).update(rawBody, "utf8").digest("hex");
  const provided = signature.startsWith("sha1=") ? signature.slice(5) : signature;

  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.warn({ providedPrefix: provided.slice(0, 8) }, "vercel webhook bad signature");
    return c.json({ error: "bad signature" }, 401);
  }

  c.set("rawBody", rawBody);
  await next();
});
