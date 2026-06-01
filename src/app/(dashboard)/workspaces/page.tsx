import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthRequired, requireSession } from "@/server/auth/require-workspace";
import { findMembershipsForUser } from "@/server/repositories/workspaces.repo";
import { CreateWorkspaceForm } from "./create-workspace-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  IconBuilding, 
  IconPlus, 
  IconLayoutDashboard,
  IconArrowRight
} from "@tabler/icons-react";

export default async function WorkspacesPage() {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    throw err;
  }

  const memberships = await findMembershipsForUser(session.user.id);

  return (
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
        <header className="relative overflow-hidden rounded-2xl bg-zinc-900 px-8 py-12 text-white dark:bg-zinc-950">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <IconLayoutDashboard className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Console</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">Workspaces</h1>
              <p className="text-zinc-400">
                Welcome back, <span className="font-medium text-white">{session.user.email}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800/50 py-1 text-zinc-300">
                {memberships.length} active {memberships.length === 1 ? 'workspace' : 'workspaces'}
              </Badge>
            </div>
          </div>
          {/* Subtle background decoration */}
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-purple-600/20 blur-3xl" />
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h2>
            </div>
            
            {memberships.length === 0 ? (
              <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-muted/30 p-16 text-center transition-colors hover:bg-muted/50">
                <div className="rounded-2xl bg-background p-5 shadow-sm ring-1 ring-foreground/5">
                  <IconBuilding className="size-10 text-muted-foreground" />
                </div>
                <div className="mt-6 max-w-sm space-y-2">
                  <h3 className="text-xl font-semibold">No workspaces found</h3>
                  <p className="text-muted-foreground">
                    You haven&apos;t joined or created any workspaces yet. Get started by creating your first one.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
                {memberships.map((m) => (
                  <Link key={m.workspaceId} href={`/${m.slug}`} className="group block">
                    <Card className="h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-primary/40">
                      <CardHeader className="border-b bg-muted/20 pb-4">
                        <div className="flex items-start justify-between">
                          <Avatar className="size-12 rounded-xl border-2 border-background shadow-sm">
                            <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 font-bold text-white uppercase">
                              {m.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <Badge variant="secondary" className="bg-background/80 font-medium backdrop-blur-sm">
                            {m.role}
                          </Badge>
                        </div>
                        <div className="mt-4 space-y-1">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">{m.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1.5 font-mono text-xs">
                            <span className="text-muted-foreground">slug:</span>
                            <span className="text-foreground/80">{m.slug}</span>
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Manage workspace</span>
                          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <IconArrowRight className="size-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="sticky top-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Create</h2>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <IconPlus className="size-5" />
                </div>
              </div>
              <Card className="border-2 border-primary/10 shadow-lg shadow-primary/5">
                <CardHeader>
                  <CardTitle>New Workspace</CardTitle>
                  <CardDescription>
                    Spin up a new environment for your team and projects.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CreateWorkspaceForm />
                </CardContent>
              </Card>

              {/* Tips/Info Card */}
              <Card className="bg-linear-to-br from-indigo-500/5 to-purple-500/5 border-none shadow-none ring-1 ring-foreground/5">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-medium">
                      <div className="size-2 rounded-full bg-blue-500" />
                      Pro Tip
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Use unique slugs for your workspaces to make them easily shareable with your team members.
                    </p>
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
