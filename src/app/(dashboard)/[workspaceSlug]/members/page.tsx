import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { invitations, user, workspaceMembers } from "@/server/db/schema";
import { withWorkspace } from "@/server/db/tenant";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { InviteMemberForm } from "./invite-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  IconUsers, 
  IconUserPlus, 
  IconMail, 
  IconCalendarClock,
  IconCircleCheck,
  IconClock,
  IconCopy
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
        <header className="relative overflow-hidden rounded-2xl bg-zinc-900 px-8 py-12 text-white dark:bg-zinc-950">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <IconUsers className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{ctx.workspaceName}</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">Team Members</h1>
              <p className="text-zinc-400">
                Manage your team and their access levels across the workspace.
              </p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800/50 py-1 text-zinc-300">
                {members.length} Active {members.length === 1 ? 'Member' : 'Members'}
              </Badge>
            </div>
          </div>
          {/* Subtle background decoration */}
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-indigo-600/20 blur-3xl" />
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Active Members</h2>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                {members.map((m) => (
                  <Card key={m.userId} className="overflow-hidden transition-all hover:ring-primary/20">
                    <CardHeader className="flex flex-row items-center gap-4 pb-4">
                      <Avatar className="size-12 rounded-xl border-2 border-background shadow-sm">
                        <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 font-bold text-white uppercase">
                          {(m.name ?? m.email ?? "U").substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{m.name ?? "Unnamed User"}</CardTitle>
                        <CardDescription className="flex items-center gap-1.5 text-xs truncate">
                          <IconMail className="size-3.5" />
                          {m.email}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px] h-5 px-2 bg-muted/30">
                        {m.role}
                      </Badge>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Pending Invitations</h2>
                <Badge variant="secondary">{pending.length}</Badge>
              </div>

              {pending.length === 0 ? (
                <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-muted/30 p-12 text-center">
                  <div className="rounded-2xl bg-background p-4 shadow-sm ring-1 ring-foreground/5">
                    <IconMail className="size-8 text-muted-foreground" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <CardTitle className="text-lg">No pending invites</CardTitle>
                    <CardDescription>
                      When you invite new members, they will appear here until they accept.
                    </CardDescription>
                  </div>
                </Card>
              ) : (
                <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
                  <ul className="divide-y">
                    {pending.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground",
                            inv.acceptedAt && "bg-emerald-500/5 text-emerald-500 border-emerald-500/10"
                          )}>
                            {inv.acceptedAt ? <IconCircleCheck className="size-5" /> : <IconClock className="size-5" />}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{inv.email}</span>
                              <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 capitalize">
                                {inv.role}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <IconCalendarClock className="size-3.5" />
                              <span>Expires {inv.expiresAt.toLocaleDateString()}</span>
                              {inv.acceptedAt && (
                                <>
                                  <Separator orientation="vertical" className="h-3" />
                                  <span className="text-emerald-500 font-medium">Accepted</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {!inv.acceptedAt && (
                          <div className="flex items-center gap-2">
                            <div className="group relative flex items-center">
                              <code className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-mono dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                /invite/{inv.token.slice(0, 8)}...
                              </code>
                              <button 
                                className="ml-2 p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                                title="Copy invitation link"
                              >
                                <IconCopy className="size-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-6 space-y-6">
              {canInvite && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold tracking-tight">Invite</h2>
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <IconUserPlus className="size-5" />
                    </div>
                  </div>
                  <Card className="border-primary/10 shadow-lg shadow-primary/5">
                    <CardHeader>
                      <CardTitle className="text-lg">Invite Member</CardTitle>
                      <CardDescription>
                        Send an invitation to join your workspace.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <InviteMemberForm workspaceSlug={workspaceSlug} />
                    </CardContent>
                  </Card>
                </>
              )}

              <Card className="bg-linear-to-br from-blue-500/5 to-indigo-500/5 border-none shadow-none ring-1 ring-foreground/5">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-medium">
                      <div className="size-2 rounded-full bg-blue-500" />
                      Role Permissions
                    </div>
                    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <p>
                        <strong className="text-foreground">Admins</strong> can manage members, projects, and settings.
                      </p>
                      <p>
                        <strong className="text-foreground">Members</strong> can view and deploy projects they have access to.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
