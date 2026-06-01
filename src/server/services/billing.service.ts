import "server-only";
import { getStripe } from "@/server/integrations/stripe";
import {
  findSubscription,
  upsertSubscription,
  findSubscriptionByCustomerId,
  insertUsageRecord,
  sumUsage,
} from "@/server/repositories/billing.repo";
import { PLAN_LIMITS, BILLING_PERIOD_DAYS } from "@/server/domain/plan-limits";
import { logger } from "@/server/security/logger";
import type { Subscription, SubscriptionPlan } from "@/server/db/schema";
import type Stripe from "stripe";

export class BillingError extends Error {
  constructor(
    public readonly code: "PLAN_LIMIT_EXCEEDED" | "STRIPE_ERROR" | "CUSTOMER_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

// ---------------------------------------------------------------------------
// Plan resolution
// ---------------------------------------------------------------------------

/** Get current plan for a workspace, defaulting to free. */
export async function getWorkspacePlan(workspaceId: string): Promise<SubscriptionPlan> {
  const sub = await findSubscription(workspaceId);
  if (!sub || sub.status === "canceled" || sub.status === "unpaid") return "free";
  return sub.plan;
}

// ---------------------------------------------------------------------------
// Limit enforcement (call from service layer before expensive ops)
// ---------------------------------------------------------------------------

/**
 * Assert the workspace has not exceeded the plan limit for `metric`.
 * Throws `BillingError` with code `PLAN_LIMIT_EXCEEDED` if over.
 */
export async function assertWithinLimit(input: {
  workspaceId: string;
  metric: keyof typeof PLAN_LIMITS["free"];
}): Promise<void> {
  const plan = await getWorkspacePlan(input.workspaceId);
  const limit = PLAN_LIMITS[plan][input.metric];
  if (limit === Infinity) return;

  if (input.metric === "deploymentsPerMonth") {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - BILLING_PERIOD_DAYS);
    const used = await sumUsage({
      workspaceId: input.workspaceId,
      metric: "deployment",
      periodStart,
    });
    if (used >= limit) {
      throw new BillingError(
        "PLAN_LIMIT_EXCEEDED",
        `${plan} plan limit: ${limit} deployments per month (${used} used). Upgrade to Pro.`,
      );
    }
    return;
  }

  // For count-based limits (projects, databases, domains), caller passes current count.
  // Those are enforced differently — see assertCountLimit below.
}

/**
 * Assert the current count of a resource is within the plan limit.
 * `currentCount` is the count BEFORE the new resource is created.
 */
export async function assertCountLimit(input: {
  workspaceId: string;
  metric: "projects" | "databases" | "domains";
  currentCount: number;
}): Promise<void> {
  const plan = await getWorkspacePlan(input.workspaceId);
  const limit = PLAN_LIMITS[plan][input.metric];
  if (limit === Infinity) return;
  if (input.currentCount >= limit) {
    throw new BillingError(
      "PLAN_LIMIT_EXCEEDED",
      `${plan} plan limit: ${limit} ${input.metric} (${input.currentCount} existing). Upgrade to Pro.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Usage recording
// ---------------------------------------------------------------------------

export async function recordUsage(input: {
  workspaceId: string;
  metric: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await insertUsageRecord({
    workspaceId: input.workspaceId,
    metric: input.metric,
    quantity: input.quantity ?? 1,
    metadata: input.metadata,
  });
}

// ---------------------------------------------------------------------------
// Stripe checkout + portal
// ---------------------------------------------------------------------------

async function getOrCreateStripeCustomer(input: {
  workspaceId: string;
  email: string;
  workspaceName: string;
}): Promise<string> {
  const stripe = getStripe();
  const sub = await findSubscription(input.workspaceId);

  if (sub?.providerCustomerId) return sub.providerCustomerId;

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.workspaceName,
    metadata: { workspaceId: input.workspaceId },
  });

  await upsertSubscription({
    workspaceId: input.workspaceId,
    plan: "free",
    status: "active",
    providerCustomerId: customer.id,
  });

  return customer.id;
}

export async function createCheckoutSession(input: {
  workspaceId: string;
  email: string;
  workspaceName: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer({
    workspaceId: input.workspaceId,
    email: input.email,
    workspaceName: input.workspaceName,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { workspaceId: input.workspaceId },
    subscription_data: {
      metadata: { workspaceId: input.workspaceId },
    },
  });

  if (!session.url) throw new BillingError("STRIPE_ERROR", "Stripe returned no checkout URL");
  return { url: session.url };
}

export async function createPortalSession(input: {
  workspaceId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const sub = await findSubscription(input.workspaceId);
  if (!sub?.providerCustomerId) {
    throw new BillingError("CUSTOMER_NOT_FOUND", "no Stripe customer for this workspace");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.providerCustomerId,
    return_url: input.returnUrl,
  });

  return { url: session.url };
}

// ---------------------------------------------------------------------------
// Stripe webhook handler (called by Hono route after sig verification)
// ---------------------------------------------------------------------------

const PLAN_FROM_PRICE: Record<string, SubscriptionPlan> = {
  // These are placeholder price IDs — replace with real ones from Stripe dashboard.
  // Format: process.env.STRIPE_PRICE_PRO_MONTHLY
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? "__unset_pro_monthly__"]: "pro",
  [process.env.STRIPE_PRICE_PRO_YEARLY ?? "__unset_pro_yearly__"]: "pro",
};

function planFromSubscription(stripeSub: Stripe.Subscription): SubscriptionPlan {
  const priceId = stripeSub.items.data[0]?.price.id ?? "";
  return PLAN_FROM_PRICE[priceId] ?? "free";
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId =
        (sub.metadata?.workspaceId as string | undefined) ??
        (await resolveWorkspaceFromCustomer(sub.customer as string));
      if (!workspaceId) {
        logger.warn({ customerId: sub.customer }, "stripe webhook: no workspaceId");
        return;
      }
      await upsertSubscription({
        workspaceId,
        plan: planFromSubscription(sub),
        status: stripeStatusMap(sub.status),
        providerCustomerId: sub.customer as string,
        providerSubscriptionId: sub.id,
        currentPeriodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
      });
      logger.info({ workspaceId, subId: sub.id, status: sub.status }, "stripe subscription upserted");
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId =
        (sub.metadata?.workspaceId as string | undefined) ??
        (await resolveWorkspaceFromCustomer(sub.customer as string));
      if (!workspaceId) return;
      await upsertSubscription({
        workspaceId,
        plan: "free",
        status: "canceled",
        providerCustomerId: sub.customer as string,
        providerSubscriptionId: sub.id,
      });
      logger.info({ workspaceId, subId: sub.id }, "stripe subscription canceled → downgraded to free");
      break;
    }

    default:
      logger.debug({ type: event.type }, "stripe webhook event ignored");
  }
}

function stripeStatusMap(status: Stripe.Subscription.Status): Subscription["status"] {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled": return "canceled";
    case "unpaid": return "unpaid";
    default: return "active";
  }
}

async function resolveWorkspaceFromCustomer(customerId: string): Promise<string | null> {
  const sub = await findSubscriptionByCustomerId(customerId);
  return sub?.workspaceId ?? null;
}
