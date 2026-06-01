import Link from "next/link";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { listProjects } from "@/server/repositories/projects.repo";
import { listDeploymentsForProject } from "@/server/repositories/deployments.repo";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  IconRocket, 
  IconPlus, 
  IconGitBranch, 
  IconHistory, 
  IconBrandGithub,
  IconArrowRight,
  IconLayoutGrid
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { DeploymentStatus } from "@/server/db/schema";

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<DeploymentStatus, string> = {
  queued: "bg-muted text-muted-foreground border-transparent",
  provisioning: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  building: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  ready: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  canceled: "bg-muted text-muted-foreground border-transparent opacity-50",
};

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });

  const projects = await listProjects(ctx.workspaceId);
  const latestByProject = await Promise.all(
    projects.map(async (p) => {
      const [latest] = await listDeploymentsForProject({
        workspaceId: ctx.workspaceId,
        projectId: p.id,
        limit: 1,
      });
      return [p.id, latest ?? null] as const;
    }),
  );
  const latestMap = new Map(latestByProject);

  return (
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
        <header className="relative overflow-hidden rounded-2xl bg-zinc-900 px-8 py-12 text-white dark:bg-zinc-950">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <IconLayoutGrid className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{ctx.workspaceName}</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">Projects</h1>
              <p className="text-zinc-400">
                Manage and deploy your applications from one place.
              </p>
            </div>
            <Button asChild size="lg" className="bg-white text-black hover:bg-zinc-200 dark:bg-white dark:text-black">
              <Link href={`/${workspaceSlug}/projects/new`}>
                <IconPlus data-icon="inline-start" />
                Connect repo
              </Link>
            </Button>
          </div>
          {/* Subtle background decoration */}
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-emerald-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-blue-600/20 blur-3xl" />
        </header>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
            <Badge variant="secondary" className="px-3 py-1">
              {projects.length} Total
            </Badge>
          </div>

          {projects.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-muted/30 p-16 text-center transition-colors hover:bg-muted/50">
              <div className="rounded-2xl bg-background p-5 shadow-sm ring-1 ring-foreground/5">
                <IconRocket className="size-10 text-muted-foreground" />
              </div>
              <div className="mt-6 max-w-sm space-y-2">
                <h3 className="text-xl font-semibold">No projects found</h3>
                <p className="text-muted-foreground">
                  Connect a GitHub repository to get started with your first deployment.
                </p>
                <div className="pt-4">
                  <Button asChild variant="outline">
                    <Link href={`/${workspaceSlug}/projects/new`}>
                      Get started
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => {
                const latest = latestMap.get(p.id);
                return (
                  <Link key={p.id} href={`/${workspaceSlug}/projects/${p.slug}`} className="group block">
                    <Card className="h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-primary/40">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <Avatar className="size-10 rounded-lg border shadow-xs">
                            <AvatarFallback className="bg-linear-to-br from-zinc-100 to-zinc-200 font-bold text-zinc-900 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-100">
                              {p.name.substring(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {latest ? (
                            <Badge variant="outline" className={cn("capitalize px-2 py-0.5", STATUS_VARIANTS[latest.status])}>
                              {latest.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <div className="mt-4 space-y-1">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">{p.name}</CardTitle>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <IconBrandGithub className="size-3.5" />
                            <span className="truncate">{p.githubRepo}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <IconGitBranch className="size-3.5" />
                            <span>{p.githubDefaultBranch}</span>
                          </div>
                          {latest && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <IconHistory className="size-3.5" />
                              <span>
                                {new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t pt-4">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project Details</span>
                          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <IconArrowRight className="size-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
