import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { findProjectBySlug } from "@/server/repositories/projects.repo";
import { listDeploymentsForProject } from "@/server/repositories/deployments.repo";
import { listEventsForResource } from "@/server/repositories/resource-events.repo";
import { listDatabasesForProject } from "@/server/repositories/databases.repo";
import { StatusPill } from "../status-pill";
import { DeployForm } from "./deploy-form";
import { DeleteProjectForm } from "./delete-form";
import { RefreshDeploymentButton } from "./refresh-button";
import { DatabaseSection } from "./database-section";

const NON_TERMINAL = new Set(["queued", "provisioning", "building"]);

export const dynamic = "force-dynamic";

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

  const databases = await listDatabasesForProject({
    workspaceId: ctx.workspaceId,
    projectId: project.id,
  });
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-1">
        <Link
          href={`/${workspaceSlug}/projects`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Projects
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <p className="text-sm text-zinc-500">
              {project.githubRepo} · {project.githubDefaultBranch}
            </p>
          </div>
          <DeployForm
            workspaceSlug={workspaceSlug}
            projectId={project.id}
            defaultBranch={project.githubDefaultBranch}
          />
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Deployments</h2>
        {deployments.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No deployments yet — click <strong>Deploy</strong> to ship the default
            branch.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {deployments.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-1">
                  <div className="font-medium">
                    {d.commitSha?.slice(0, 7) ?? "(no sha)"} · {d.branch}
                  </div>
                  <div className="text-xs text-zinc-500">
                    created {new Date(d.createdAt).toLocaleString()}
                    {d.finishedAt
                      ? ` · finished ${new Date(d.finishedAt).toLocaleString()}`
                      : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {NON_TERMINAL.has(d.status) ? (
                    <RefreshDeploymentButton
                      workspaceSlug={workspaceSlug}
                      deploymentId={d.id}
                    />
                  ) : null}
                  <StatusPill status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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

      {events.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Latest deployment events</h2>
          <ul className="space-y-1 rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 font-mono">
                <span className="text-zinc-500">
                  {new Date(e.createdAt).toISOString().slice(11, 19)}
                </span>
                <span>
                  {e.fromState ?? "∅"} → {e.toState}
                </span>
                <span className="text-zinc-500">{e.actor}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(ctx.role === "owner" || ctx.role === "admin") ? (
        <section className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500">Danger zone</h2>
          <DeleteProjectForm
            workspaceSlug={workspaceSlug}
            projectId={project.id}
            projectName={project.name}
          />
          <p className="text-xs text-zinc-500">
            Project is hidden immediately. Vercel project + history are torn down after a
            24-hour grace window by the cleanup job.
          </p>
        </section>
      ) : null}
    </main>
  );
}
