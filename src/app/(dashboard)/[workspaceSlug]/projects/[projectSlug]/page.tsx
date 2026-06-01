import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { findProjectBySlug } from "@/server/repositories/projects.repo";
import { listDeploymentsForProject } from "@/server/repositories/deployments.repo";
import { listEventsForResource } from "@/server/repositories/resource-events.repo";
import { listDatabasesForProject } from "@/server/repositories/databases.repo";
import { listDomainsForProject } from "@/server/repositories/domains.repo";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  IconArrowLeft,
  IconGitBranch,
  IconHistory,
  IconBrandGithub,
  IconTerminal2,
  IconAlertTriangle,
  IconSettings,
  IconRefresh,
  IconLoader2,
  IconDatabase,
  IconRocket,
  IconGlobe,
  IconVariable,
} from "@tabler/icons-react";
import { DeployForm } from "./deploy-form";
import { DeleteProjectForm } from "./delete-form";
import { RefreshDeploymentButton } from "./refresh-button";
import { DatabaseSection } from "./database-section";
import { DomainSection } from "./domain-section";
import { EnvVarsSection } from "./env-vars-section";
import { listEnvVars } from "@/server/services/env-vars.service";
import { cn } from "@/lib/utils";
import type { DeploymentStatus } from "@/server/db/schema";

const NON_TERMINAL = new Set(["queued", "provisioning", "building"]);

export const dynamic = "force-dynamic";

const STATUS_VARIANTS: Record<DeploymentStatus, string> = {
  queued: "bg-muted text-muted-foreground border-transparent",
  provisioning: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  building: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  ready: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  canceled: "bg-muted text-muted-foreground border-transparent opacity-50",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectSlug: string }>;
}) {
  const { workspaceSlug, projectSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });

  const project = await findProjectBySlug(ctx.workspaceId, projectSlug);
  if (!project) notFound();

  const deployments = await listDeploymentsForProject({
    workspaceId: ctx.workspaceId,
    projectId: project.id,
    limit: 20,
  });

  const events = deployments[0]
    ? await listEventsForResource({
        workspaceId: ctx.workspaceId,
        resourceType: "deployment",
        resourceId: deployments[0].id,
        limit: 20,
      })
    : [];

  const [databases, domains, envVars] = await Promise.all([
    listDatabasesForProject({ workspaceId: ctx.workspaceId, projectId: project.id }),
    listDomainsForProject({ workspaceId: ctx.workspaceId, projectId: project.id }),
    listEnvVars(ctx.workspaceId, project.id),
  ]);
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
        <header className="relative overflow-hidden rounded-2xl bg-zinc-900 px-8 py-12 text-white dark:bg-zinc-950">
          <div className="relative z-10 flex flex-col gap-6">
            <Link
              href={`/${workspaceSlug}/projects`}
              className="flex w-fit items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              <IconArrowLeft className="size-4" />
              Back to Projects
            </Link>
            
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-400">
                  <IconBrandGithub className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">{project.githubRepo}</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
                <div className="flex items-center gap-3 text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <IconGitBranch className="size-4" />
                    <span className="text-sm font-medium">{project.githubDefaultBranch}</span>
                  </div>
                  <Separator orientation="vertical" className="h-4 bg-zinc-800" />
                  <div className="flex items-center gap-1.5">
                    <IconHistory className="size-4" />
                    <span className="text-sm">{deployments.length} deployments</span>
                  </div>
                </div>
              </div>
              
              <DeployForm
                workspaceSlug={workspaceSlug}
                projectId={project.id}
                defaultBranch={project.githubDefaultBranch}
              />
            </div>
          </div>
          {/* Subtle background decoration */}
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-indigo-600/10 blur-3xl" />
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-10">
            <Tabs defaultValue="deployments" className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-muted/50 p-1">
                  <TabsTrigger value="deployments" className="gap-2">
                    <IconRocket className="size-3.5" />
                    Deployments
                  </TabsTrigger>
                  <TabsTrigger value="databases" className="gap-2">
                    <IconDatabase className="size-3.5" />
                    Databases
                  </TabsTrigger>
                  <TabsTrigger value="domains" className="gap-2">
                    <IconGlobe className="size-3.5" />
                    Domains
                  </TabsTrigger>
                  <TabsTrigger value="env-vars" className="gap-2">
                    <IconVariable className="size-3.5" />
                    Env Vars
                  </TabsTrigger>
                </TabsList>
                <Badge variant="secondary" className="hidden sm:inline-flex">Project Overview</Badge>
              </div>

              <TabsContent value="deployments" className="space-y-6 mt-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground/90">Deployment History</h2>
                </div>
                
                {deployments.length === 0 ? (
                  <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-muted/30 p-12 text-center">
                    <IconRefresh className="size-8 text-muted-foreground animate-pulse" />
                    <div className="mt-4 space-y-2">
                      <CardTitle className="text-lg">No deployments yet</CardTitle>
                      <CardDescription>
                        Click the <strong>Deploy</strong> button above to ship your first version.
                      </CardDescription>
                    </div>
                  </Card>
                ) : (
                  <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
                    <ul className="divide-y">
                      {deployments.map((d) => (
                        <li key={d.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/30">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "flex size-10 items-center justify-center rounded-lg border",
                              d.status === "ready" ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" : "bg-muted text-muted-foreground"
                            )}>
                              <IconTerminal2 className="size-5" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold">{d.commitSha?.slice(0, 7) ?? "(no sha)"}</span>
                                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                                  {d.branch}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{new Date(d.createdAt).toLocaleDateString()} at {new Date(d.createdAt).toLocaleTimeString()}</span>
                                {d.finishedAt && (
                                  <>
                                    <span>·</span>
                                    <span>{Math.round((new Date(d.finishedAt).getTime() - new Date(d.createdAt).getTime()) / 1000)}s</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {NON_TERMINAL.has(d.status) && (
                              <RefreshDeploymentButton
                                workspaceSlug={workspaceSlug}
                                deploymentId={d.id}
                              />
                            )}
                            <Badge variant="outline" className={cn("capitalize", STATUS_VARIANTS[d.status])}>
                              {d.status === "provisioning" || d.status === "building" ? (
                                <IconLoader2 className="size-3 mr-1 animate-spin" />
                              ) : null}
                              {d.status}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="databases" className="mt-0">
                <DatabaseSection
                  workspaceSlug={workspaceSlug}
                  projectId={project.id}
                  databases={databases.map((d) => ({
                    id: d.id,
                    databaseName: d.databaseName,
                    roleName: d.roleName,
                    host: d.host,
                    status: d.status,
                    neonProjectId: d.neonProjectId,
                    createdAt: d.createdAt,
                  }))}
                  canManage={canManage}
                />
              </TabsContent>

              <TabsContent value="domains" className="mt-0">
                <DomainSection
                  workspaceSlug={workspaceSlug}
                  projectId={project.id}
                  domains={domains.map((d) => ({
                    id: d.id,
                    domain: d.domain,
                    verifiedAt: d.verifiedAt,
                    vercelVerification: d.vercelVerification,
                    createdAt: d.createdAt,
                  }))}
                  canManage={canManage}
                />
              </TabsContent>

              <TabsContent value="env-vars" className="mt-0">
                <EnvVarsSection
                  workspaceSlug={workspaceSlug}
                  projectSlug={projectSlug}
                  initialVars={envVars}
                  canManage={canManage}
                />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-8">
            {events.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                  <IconTerminal2 className="size-5 text-primary" />
                  <h2>Activity Logs</h2>
                </div>
                <Card className="bg-zinc-950 text-zinc-400 shadow-xl overflow-hidden border-zinc-800">
                  <ScrollArea className="h-100">
                    <div className="p-4 font-mono text-[11px] leading-relaxed">
                      {events.map((e) => (
                        <div key={e.id} className="mb-3 border-l border-zinc-800 pl-3">
                          <div className="flex justify-between items-center mb-1 text-zinc-500">
                            <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
                            <span className="bg-zinc-800 px-1 rounded text-[9px] uppercase tracking-tighter">{e.actor}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-600">{e.fromState ?? "∅"}</span>
                            <span className="text-primary/70">→</span>
                            <span className="text-emerald-400 font-bold">{e.toState}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              </section>
            )}

            {canManage && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-destructive">
                  <IconAlertTriangle className="size-5" />
                  <h2>Danger Zone</h2>
                </div>
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Delete Project</CardTitle>
                    <CardDescription>
                      This will permanently remove the project and its resources.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <DeleteProjectForm
                      workspaceSlug={workspaceSlug}
                      projectId={project.id}
                      projectName={project.name}
                    />
                    <p className="text-[11px] leading-normal text-muted-foreground">
                      Project is hidden immediately. Vercel resources are torn down after a
                      24-hour grace window.
                    </p>
                  </CardContent>
                </Card>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <IconSettings className="size-5 text-muted-foreground" />
                <h2>Settings</h2>
              </div>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Region</span>
                    <span className="font-medium">aws-us-east-1</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Framework</span>
                    <Badge variant="outline">Next.js</Badge>
                  </div>
                </CardContent>
              </Card>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
