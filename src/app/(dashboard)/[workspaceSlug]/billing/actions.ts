"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AuthRequired,
  requireWorkspace,
  WorkspaceForbidden,
} from "@/server/auth/require-workspace";
import {
  createCheckoutSession,
  createPortalSession,
  BillingError,
} from "@/server/services/billing.service";

async function resolveCtx(workspaceSlug: string) {
  try {
    return await requireWorkspace({ workspaceSlug });
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    if (err instanceof WorkspaceForbidden) redirect("/workspaces");
    throw err;
  }
}

const upgradeSchema = z.object({
  workspaceSlug: z.string().min(1),
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type UpgradeResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function upgradeAction(
  _prev: UpgradeResult | null,
  formData: FormData,
): Promise<UpgradeResult> {
  const parsed = upgradeSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    priceId: formData.get("priceId"),
    successUrl: formData.get("successUrl"),
    cancelUrl: formData.get("cancelUrl"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  try {
    const { url } = await createCheckoutSession({
      workspaceId: ctx.workspaceId,
      email: ctx.userEmail,
      workspaceName: ctx.workspaceName,
      priceId: parsed.data.priceId,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
    });
    redirect(url);
  } catch (err) {
    if (err instanceof BillingError) return { ok: false, error: err.message };
    throw err;
  }
}

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function portalAction(
  _prev: PortalResult | null,
  formData: FormData,
): Promise<PortalResult> {
  const workspaceSlug = formData.get("workspaceSlug") as string | null;
  if (!workspaceSlug) return { ok: false, error: "missing workspace" };

  const ctx = await resolveCtx(workspaceSlug);

  // Build return URL from origin — safe to use the standard pattern.
  const returnUrl = `/${ctx.workspaceSlug}/billing`;

  try {
    const { url } = await createPortalSession({
      workspaceId: ctx.workspaceId,
      returnUrl,
    });
    redirect(url);
  } catch (err) {
    if (err instanceof BillingError) return { ok: false, error: err.message };
    throw err;
  }
}
