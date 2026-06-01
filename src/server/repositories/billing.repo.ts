import "server-only";
import { eq, and, gte, sum } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import {
  subscriptions,
  usageRecords,
  type Subscription,
  type UsageRecord,
} from "@/server/db/schema";

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function findSubscription(workspaceId: string): Promise<Subscription | null> {
  const [row] = await withWorkspace(workspaceId, (tx) =>
    tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1),
  );
  return row ?? null;
}

export async function upsertSubscription(input: {
  workspaceId: string;
  plan: Subscription["plan"];
  status: Subscription["status"];
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodEnd?: Date;
}): Promise<Subscription> {
  const [row] = await withWorkspace(input.workspaceId, (tx) =>
    tx
      .insert(subscriptions)
      .values({
        workspaceId: input.workspaceId,
        plan: input.plan,
        status: input.status,
        providerCustomerId: input.providerCustomerId ?? null,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscriptions.workspaceId,
        set: {
          plan: input.plan,
          status: input.status,
          providerCustomerId: input.providerCustomerId ?? null,
          providerSubscriptionId: input.providerSubscriptionId ?? null,
          currentPeriodEnd: input.currentPeriodEnd ?? null,
          updatedAt: new Date(),
        },
      })
      .returning(),
  );
  return row!;
}

export async function findSubscriptionByCustomerId(
  providerCustomerId: string,
): Promise<Subscription | null> {
  // Untenanted — called by webhook handler before workspace is known.
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.providerCustomerId, providerCustomerId))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export async function insertUsageRecord(input: {
  workspaceId: string;
  metric: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}): Promise<UsageRecord> {
  const [row] = await withWorkspace(input.workspaceId, (tx) =>
    tx
      .insert(usageRecords)
      .values({
        workspaceId: input.workspaceId,
        metric: input.metric,
        quantity: input.quantity,
        metadata: input.metadata ?? null,
      })
      .returning(),
  );
  return row!;
}

/** Sum usage of `metric` in [periodStart, now]. Returns 0 if no records. */
export async function sumUsage(input: {
  workspaceId: string;
  metric: string;
  periodStart: Date;
}): Promise<number> {
  const [row] = await withWorkspace(input.workspaceId, (tx) =>
    tx
      .select({ total: sum(usageRecords.quantity) })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.workspaceId, input.workspaceId),
          eq(usageRecords.metric, input.metric),
          gte(usageRecords.recordedAt, input.periodStart),
        ),
      ),
  );
  return Number(row?.total ?? 0);
}
