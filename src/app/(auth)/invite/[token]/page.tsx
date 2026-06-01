import { redirect } from "next/navigation";
import {
  AuthRequired,
  requireSession,
} from "@/server/auth/require-workspace";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { workspaces } from "@/server/db/schema";
import { findInvitationByToken } from "@/server/repositories/invitations.repo";
import { AcceptInviteForm } from "./accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (err) {
    if (err instanceof AuthRequired) {
      redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
    }
    throw err;
  }

  const invitation = await findInvitationByToken(token);
  if (!invitation) {
    return (
      <main className="mx-auto max-w-md space-y-3 p-8">
        <h1 className="text-2xl font-semibold">Invite invalid</h1>
        <p className="text-sm text-zinc-500">This link is expired or already used.</p>
      </main>
    );
  }

  const [workspace] = await db
    .select({ name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, invitation.workspaceId))
    .limit(1);
  if (!workspace) redirect("/workspaces");

  const emailMismatch =
    invitation.email.toLowerCase() !== session.user.email.toLowerCase();

  return (
    <main className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Join {workspace.name}</h1>
      <p className="text-sm text-zinc-500">
        You were invited as <strong>{invitation.role}</strong>.
      </p>
      {emailMismatch ? (
        <p className="text-sm text-red-600">
          This invite is for {invitation.email}, but you are signed in as{" "}
          {session.user.email}. Sign out and sign in with the invited address.
        </p>
      ) : (
        <AcceptInviteForm token={token} />
      )}
    </main>
  );
}
