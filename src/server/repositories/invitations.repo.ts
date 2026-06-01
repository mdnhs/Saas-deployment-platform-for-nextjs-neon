import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import { invitations, workspaceMembers } from "@/server/db/schema";
import type { Invitation } from "@/server/db/schema";

export async function createInvitation(input: {
  workspaceId: string;
  email: string;
  role: "owner" | "admin" | "member";
  token: string;
  invitedBy: string;
  expiresAt: Date;
}): Promise<Invitation> {
  return withWorkspace(input.workspaceId, async (tx) => {
    const [row] = await tx
      .insert(invitations)
      .values({
        workspaceId: input.workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        token: input.token,
        invitedBy: input.invitedBy,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) throw new Error("createInvitation returned no row");
    return row;
  });
}

/**
 * Looked up by opaque token — necessarily untenanted, since the inviter is sharing
 * the token before the recipient has a session. The caller MUST verify the email
 * matches the accepting user's session email before consuming.
 */
export async function findInvitationByToken(token: string) {
  const rows = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token, token),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Atomically consume an invitation and add the user as a member. The whole thing
 * runs inside `withWorkspace` so RLS sees both writes under the same tenant GUC.
 */
export async function acceptInvitation(input: {
  invitationId: string;
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}) {
  return withWorkspace(input.workspaceId, async (tx) => {
    const [accepted] = await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(and(eq(invitations.id, input.invitationId), isNull(invitations.acceptedAt)))
      .returning();
    if (!accepted) throw new Error("Invitation already consumed or not found");

    await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.role,
      })
      .onConflictDoNothing({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      });

    return accepted;
  });
}
