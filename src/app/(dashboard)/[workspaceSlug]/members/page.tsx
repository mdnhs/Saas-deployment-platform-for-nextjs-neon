import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { invitations, user, workspaceMembers } from "@/server/db/schema";
import { withWorkspace } from "@/server/db/tenant";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { InviteMemberForm } from "./invite-form";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });
  void (await headers());

  const members = await withWorkspace(ctx.workspaceId, (tx) =>
    tx
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        email: user.email,
        name: user.name,
      })
      .from(workspaceMembers)
      .innerJoin(user, eq(user.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, ctx.workspaceId)),
  );

  const pending = await withWorkspace(ctx.workspaceId, (tx) =>
    tx
      .select()
      .from(invitations)
      .where(eq(invitations.workspaceId, ctx.workspaceId)),
  );

  const canInvite = ctx.role === "owner" || ctx.role === "admin";

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Members</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Active</h2>
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-zinc-500">{m.email}</div>
              </div>
              <span className="text-xs uppercase text-zinc-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Pending invitations</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">None.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {pending.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-xs text-zinc-500">
                    {inv.role} · expires {inv.expiresAt.toISOString().slice(0, 10)}
                    {inv.acceptedAt ? " · accepted" : ""}
                  </div>
                </div>
                {!inv.acceptedAt ? (
                  <code className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
                    /invite/{inv.token.slice(0, 8)}…
                  </code>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canInvite ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Invite a member</h2>
          <InviteMemberForm workspaceSlug={workspaceSlug} />
        </section>
      ) : null}
    </main>
  );
}
