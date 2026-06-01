"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { workspaces } from "@/server/db/schema";
import { AuthRequired, requireSession } from "@/server/auth/require-workspace";
import {
  consumeInvitation,
  InvitationServiceError,
} from "@/server/services/invitations.service";

export type AcceptInviteResult =
  | { ok: true; workspaceSlug: string }
  | { ok: false; error: string };

const schema = z.object({ token: z.string().min(1) });

export async function acceptInviteAction(
  _prev: AcceptInviteResult | null,
  formData: FormData,
): Promise<AcceptInviteResult> {
  const parsed = schema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { ok: false, error: "missing token" };

  let session;
  try {
    session = await requireSession();
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    throw err;
  }

  try {
    const { workspaceId } = await consumeInvitation({
      token: parsed.data.token,
      userId: session.user.id,
      userEmail: session.user.email,
    });
    const [ws] = await db
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    return { ok: true, workspaceSlug: ws?.slug ?? "" };
  } catch (err) {
    if (err instanceof InvitationServiceError) return { ok: false, error: err.message };
    throw err;
  }
}
