"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AuthRequired,
  requireWorkspace,
  WorkspaceForbidden,
} from "@/server/auth/require-workspace";
import {
  storeCredential,
  CredentialServiceError,
} from "@/server/services/credentials.service";
import { softDeleteCredential } from "@/server/repositories/credentials.repo";

export type StoreCredentialResult =
  | { ok: true; provider: string }
  | { ok: false; error: string };

async function resolveCtx(workspaceSlug: string) {
  try {
    const ctx = await requireWorkspace({ workspaceSlug });
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      throw new WorkspaceForbidden(workspaceSlug);
    }
    return ctx;
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    if (err instanceof WorkspaceForbidden) redirect(`/${workspaceSlug}`);
    throw err;
  }
}

const vercelSchema = z.object({
  workspaceSlug: z.string().min(1),
  token: z.string().trim().min(20).max(512),
  teamId: z.string().trim().max(64).optional(),
});

export async function saveVercelCredentialAction(
  _prev: StoreCredentialResult | null,
  formData: FormData,
): Promise<StoreCredentialResult> {
  const parsed = vercelSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    token: formData.get("token"),
    teamId: (formData.get("teamId") as string | null) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  try {
    await storeCredential({
      workspaceId: ctx.workspaceId,
      provider: "vercel",
      kind: "api_key",
      plaintext: parsed.data.token,
      metadata: parsed.data.teamId ? { teamId: parsed.data.teamId } : undefined,
      createdBy: ctx.userId,
    });
    revalidatePath(`/${ctx.workspaceSlug}/settings`);
    return { ok: true, provider: "vercel" };
  } catch (err) {
    if (err instanceof CredentialServiceError) return { ok: false, error: err.message };
    throw err;
  }
}

const neonSchema = z.object({
  workspaceSlug: z.string().min(1),
  token: z.string().trim().min(20).max(512),
});

export async function saveNeonCredentialAction(
  _prev: StoreCredentialResult | null,
  formData: FormData,
): Promise<StoreCredentialResult> {
  const parsed = neonSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  try {
    await storeCredential({
      workspaceId: ctx.workspaceId,
      provider: "neon",
      kind: "api_key",
      plaintext: parsed.data.token,
      createdBy: ctx.userId,
    });
    revalidatePath(`/${ctx.workspaceSlug}/settings`);
    return { ok: true, provider: "neon" };
  } catch (err) {
    if (err instanceof CredentialServiceError) return { ok: false, error: err.message };
    throw err;
  }
}

const deleteSchema = z.object({
  workspaceSlug: z.string().min(1),
  credentialId: z.string().uuid(),
});

export async function deleteCredentialAction(
  _prev: StoreCredentialResult | null,
  formData: FormData,
): Promise<StoreCredentialResult> {
  const parsed = deleteSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    credentialId: formData.get("credentialId"),
  });
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  await softDeleteCredential(ctx.workspaceId, parsed.data.credentialId);
  revalidatePath(`/${ctx.workspaceSlug}/settings`);
  return { ok: true, provider: "deleted" };
}
