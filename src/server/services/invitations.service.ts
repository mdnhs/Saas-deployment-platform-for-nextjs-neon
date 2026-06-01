import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  acceptInvitation as acceptInvitationRow,
  createInvitation as createInvitationRow,
  findInvitationByToken,
} from "@/server/repositories/invitations.repo";
import { logger } from "@/server/security/logger";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export class InvitationServiceError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "TOKEN_INVALID" | "EMAIL_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "InvitationServiceError";
  }
}

const inviteInputSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "member"]),
  invitedBy: z.string().min(1),
});

export async function inviteMember(input: z.input<typeof inviteInputSchema>) {
  const parsed = inviteInputSchema.safeParse(input);
  if (!parsed.success)
    throw new InvitationServiceError("INVALID_INPUT", parsed.error.message);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const row = await createInvitationRow({ ...parsed.data, token, expiresAt });
  logger.info(
    { invitationId: row.id, workspaceId: row.workspaceId, email: row.email },
    "invitation.created",
  );
  return row;
}

/**
 * Consume an invitation. Caller MUST already have a session — pass its userId and
 * email. We enforce that the session email equals the invitation email so a leaked
 * token cannot be redeemed by an attacker who happens to be signed in.
 */
export async function consumeInvitation(input: {
  token: string;
  userId: string;
  userEmail: string;
}) {
  const invitation = await findInvitationByToken(input.token);
  if (!invitation)
    throw new InvitationServiceError(
      "TOKEN_INVALID",
      "invite invalid or expired",
    );
  if (invitation.email.toLowerCase() !== input.userEmail.toLowerCase()) {
    throw new InvitationServiceError(
      "EMAIL_MISMATCH",
      "invite was issued for a different email",
    );
  }

  await acceptInvitationRow({
    invitationId: invitation.id,
    workspaceId: invitation.workspaceId,
    userId: input.userId,
    role: invitation.role,
  });

  logger.info(
    {
      invitationId: invitation.id,
      workspaceId: invitation.workspaceId,
      userId: input.userId,
    },
    "invitation.accepted",
  );
  return { workspaceId: invitation.workspaceId };
}
