"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireWorkspace,
  AuthRequired,
  WorkspaceForbidden,
} from "@/server/auth/require-workspace";
import {
  inviteMember,
  InvitationServiceError,
} from "@/server/services/invitations.service";
import { redirect } from "next/navigation";

export type InviteResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const schema = z.object({
  workspaceSlug: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "member"]),
});

export async function inviteMemberAction(
  _prev: InviteResult | null,
  formData: FormData,
): Promise<InviteResult> {
  const parsed = schema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }

  let ctx;
  try {
    ctx = await requireWorkspace({ workspaceSlug: parsed.data.workspaceSlug });
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    if (err instanceof WorkspaceForbidden) redirect("/workspaces");
    throw err;
  }

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { ok: false, error: "only owners and admins can invite" };
  }

  try {
    await inviteMember({
      workspaceId: ctx.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: ctx.userId,
    });
    revalidatePath(`/${ctx.workspaceSlug}/members`);
    return { ok: true, email: parsed.data.email };
  } catch (err) {
    if (err instanceof InvitationServiceError) return { ok: false, error: err.message };
    throw err;
  }
}
