import { Hono } from "hono";
import { getStripe } from "@/server/integrations/stripe";
import { handleStripeWebhookEvent } from "@/server/services/billing.service";
import { logger } from "@/server/security/logger";
import type Stripe from "stripe";

export const stripeWebhooks = new Hono();

/**
 * Stripe webhook endpoint. Stripe signs every delivery with HMAC-SHA256;
 * we verify before parsing — Invariant #7. The endpoint must receive the
 * raw (un-parsed) body, so we read text() before anything else.
 */
stripeWebhooks.post("/", async (c) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("stripe webhook hit but STRIPE_WEBHOOK_SECRET is unset");
    return c.json({ error: "webhook not configured" }, 500);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) {
    logger.warn("stripe webhook missing stripe-signature header");
    return c.json({ error: "missing signature" }, 401);
  }

  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "stripe webhook bad signature");
    return c.json({ error: "bad signature" }, 401);
  }

  try {
    await handleStripeWebhookEvent(event);
  } catch (err) {
    logger.error({ err, eventType: event.type }, "stripe webhook handler error");
    // Return 500 so Stripe retries. Our handler is idempotent so retries are safe.
    return c.json({ error: "handler error" }, 500);
  }

  return c.json({ ok: true });
});
