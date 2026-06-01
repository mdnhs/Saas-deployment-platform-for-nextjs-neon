import "server-only";
import { and, count, desc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import { projects, type NewProject, type Project } from "@/server/db/schema";

export async function listProjects(workspaceId: string): Promise<Project[]> {
  return withWorkspace(workspaceId, (tx) =>
    tx
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.createdAt)),
  );
}

export async function findProjectBySlug(workspaceId: string, slug: string) {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          eq(projects.slug, slug),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function findProjectById(workspaceId: string, projectId: string) {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(projects)
      .where(
        and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function countActiveProjects(workspaceId: string): Promise<number> {
  const [row] = await withWorkspace(workspaceId, (tx) =>
    tx
      .select({ n: count() })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt))),
  );
  return Number(row?.n ?? 0);
}

export async function insertProject(input: NewProject): Promise<Project> {
  return withWorkspace(input.workspaceId, async (tx) => {
    const [row] = await tx.insert(projects).values(input).returning();
    if (!row) throw new Error("insertProject returned no row");
    return row;
  });
}

export async function attachVercelProjectId(input: {
  workspaceId: string;
  projectId: string;
  vercelProjectId: string;
}) {
  return withWorkspace(input.workspaceId, async (tx) => {
    await tx
      .update(projects)
      .set({ vercelProjectId: input.vercelProjectId })
      .where(
        and(
          eq(projects.workspaceId, input.workspaceId),
          eq(projects.id, input.projectId),
        ),
      );
  });
}

/** Mark a project as soft-deleted. Cleanup job tears down externals + hard deletes. */
export async function softDeleteProject(workspaceId: string, projectId: string) {
  return withWorkspace(workspaceId, async (tx) => {
    const [row] = await tx
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          eq(projects.id, projectId),
          isNull(projects.deletedAt),
        ),
      )
      .returning();
    return row ?? null;
  });
}

/**
 * Find projects soft-deleted before `cutoff` that still have external resources
 * to tear down. Untenanted: the cleanup job runs across all workspaces.
 */
export async function findCleanupCandidates(input: { cutoff: Date; limit?: number }) {
  return db
    .select()
    .from(projects)
    .where(and(isNotNull(projects.deletedAt), lt(projects.deletedAt, input.cutoff)))
    .orderBy(desc(projects.deletedAt))
    .limit(input.limit ?? 50);
}

/** Hard delete after externals are torn down. Untenanted because the cleanup job operates platform-wide. */
export async function hardDeleteProject(workspaceId: string, projectId: string) {
  // We still set the workspace GUC so RLS can audit-trail the delete in case
  // future policies require it.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`);
    await tx
      .delete(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)));
  });
}

/** Clear vercel_project_id once external resource is torn down, before hard delete. */
export async function detachVercelProjectId(workspaceId: string, projectId: string) {
  return withWorkspace(workspaceId, async (tx) => {
    await tx
      .update(projects)
      .set({ vercelProjectId: null })
      .where(
        and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)),
      );
  });
}
