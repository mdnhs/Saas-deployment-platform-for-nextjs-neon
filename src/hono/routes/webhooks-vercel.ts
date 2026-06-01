import { Hono } from "hono";
import { z } from "zod";
import { verifyVercelSignature } from "@/hono/middlewares/verify-vercel-signature";
import { findDeploymentByVercelId } from "@/server/repositories/deployments.repo";
import { claimWebhookDelivery } from "@/server/repositories/webhook-deliveries.repo";
import { transitionDeployment } from "@/server/domain/transition-deployment";
import type { DeploymentStatus } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

export const vercelWebhooks = new Hono<{ Variables: { rawBody: string } }>();

const payloadSchema = z.object({
  type: z.string(),
  payload: z
    .object({
      deployment: z
        .object({
          id: z.string().optional(),
        })
        .optional(),
      deploymentId: z.string().optional(),
    })
    .passthrough(),
});

/**
 * Vercel webhook events we care about for the MVP loop:
 *   - deployment.created    → matches our `queued → provisioning` (worker drove it; no-op)
 *   - deployment.succeeded  → ready
 *   - deployment.error      → failed
 *   - deployment.canceled   → canceled
 *
 * Any unknown event type is logged + 200'd so Vercel doesn't retry. The state
 * machine treats `from === to` as idempotent so redelivery of the same event is
 * a no-op.
 */
const EVENT_TO_STATUS: Record<string, DeploymentStatus | undefined> = {
  "deployment.created": "provisioning",
  "deployment.building": "building",
  "deployment.ready": "ready",
  "deployment.succeeded": "ready",
  "deployment.error": "failed",
  "deployment.canceled": "canceled",
};

vercelWebhooks.post("/", verifyVercelSignature, async (c) => {
  const rawBody = c.var.rawBody;

  const parsed = payloadSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    logger.warn({ err: parsed.error.message }, "vercel webhook bad payload");
    return c.json({ error: "bad payload" }, 400);
  }

  // Defense-in-depth dedupe. Vercel sends a unique id per delivery in
  // `x-vercel-id`; we insert it before doing real work and skip if we've seen
  // it. The state machine `from===to` no-op is the other safeguard.
  const deliveryId = c.req.header("x-vercel-id") ?? c.req.header("x-vercel-delivery") ?? null;
  if (deliveryId) {
    const fresh = await claimWebhookDelivery({
      provider: "vercel",
      deliveryId,
      eventType: parsed.data.type,
    });
    if (!fresh) {
      logger.debug({ deliveryId, type: parsed.data.type }, "vercel webhook redelivery");
      return c.json({ ok: true, skipped: "redelivery" });
    }
  }

  const vercelDeploymentId =
    parsed.data.payload.deployment?.id ?? parsed.data.payload.deploymentId;
  if (!vercelDeploymentId) {
    logger.warn({ type: parsed.data.type }, "vercel webhook payload has no deployment id");
    return c.json({ ok: true, skipped: "no deployment id" });
  }

  const deployment = await findDeploymentByVercelId(vercelDeploymentId);
  if (!deployment) {
    // Webhook arrived before we recorded the external ID, or it's for a
    // deployment we never created. Acknowledge so Vercel stops retrying;
    // the reconciler will pick up any rows still stuck after timeout.
    logger.warn({ vercelDeploymentId, type: parsed.data.type }, "vercel webhook unknown deployment");
    return c.json({ ok: true, skipped: "unknown deployment" });
  }

  const target = EVENT_TO_STATUS[parsed.data.type];
  if (!target) {
    logger.debug({ type: parsed.data.type }, "vercel webhook event ignored");
    return c.json({ ok: true, skipped: parsed.data.type });
  }

  try {
    const result = await transitionDeployment({
      deploymentId: deployment.id,
      workspaceId: deployment.workspaceId,
      to: target,
      actor: "webhook:vercel",
      payload: { eventType: parsed.data.type, vercelDeploymentId },
    });
    return c.json({ ok: true, result });
  } catch (err) {
    // Bad transitions are loud — but to Vercel we acknowledge so it doesn't
    // retry an event we will never accept (e.g. `ready → failed` after the
    // reconciler already finalized). The error is in our logs.
    logger.error(
      { err: err instanceof Error ? err.message : String(err), deploymentId: deployment.id },
      "vercel webhook transition rejected",
    );
    return c.json({ ok: true, skipped: "rejected" });
  }
});
