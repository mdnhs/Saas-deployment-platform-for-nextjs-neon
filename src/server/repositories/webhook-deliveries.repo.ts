import "server-only";
import { db } from "@/server/db/client";
import { webhookDeliveries } from "@/server/db/schema";

/**
 * Atomically claim a webhook delivery. Returns `true` if this is the first time
 * we've seen `(provider, deliveryId)`, `false` if it's a redelivery and the
 * caller should ack-and-skip. Untenanted — webhooks arrive before tenant
 * context exists.
 */
export async function claimWebhookDelivery(input: {
  provider: string;
  deliveryId: string;
  eventType: string;
}): Promise<boolean> {
  const inserted = await db
    .insert(webhookDeliveries)
    .values({
      provider: input.provider,
      deliveryId: input.deliveryId,
      eventType: input.eventType,
    })
    .onConflictDoNothing({
      target: [webhookDeliveries.provider, webhookDeliveries.deliveryId],
    })
    .returning({ id: webhookDeliveries.id });
  return inserted.length > 0;
}
