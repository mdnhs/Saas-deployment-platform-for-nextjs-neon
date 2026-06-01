import Link from "next/link";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { listProjects } from "@/server/repositories/projects.repo";
import { listDeploymentsForProject } from "@/server/repositories/deployments.repo";
import { StatusPill } from "./status-pill";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link
          href={`/${workspaceSlug}/projects/new`}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Connect repo
        </Link>
      </header>

      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No projects yet. Connect a GitHub repo to deploy your first one.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {projects.map((p) => {
            const latest = latestMap.get(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-1">
                  <Link
                    href={`/${workspaceSlug}/projects/${p.slug}`}
                    className="font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {p.githubRepo} · {p.githubDefaultBranch}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {latest ? (
                    <>
                      <span className="text-xs text-zinc-500">
                        {new Date(latest.createdAt).toLocaleString()}
                      </span>
                      <StatusPill status={latest.status} />
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500">never deployed</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
