import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import {
  projectEnvVars,
  type ProjectEnvVar,
  type NewProjectEnvVar,
} from "@/server/db/schema";

export async function listEnvVarsForProject(
  workspaceId: string,
  projectId: string,
): Promise<ProjectEnvVar[]> {
  return withWorkspace(workspaceId, (tx) =>
    tx
      .select()
      .from(projectEnvVars)
      .where(
        and(
          eq(projectEnvVars.workspaceId, workspaceId),
          eq(projectEnvVars.projectId, projectId),
          isNull(projectEnvVars.deletedAt),
        ),
      )
      .orderBy(projectEnvVars.key),
  );
}

export async function findEnvVarById(
  workspaceId: string,
  id: string,
): Promise<ProjectEnvVar | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(projectEnvVars)
      .where(
        and(
          eq(projectEnvVars.workspaceId, workspaceId),
          eq(projectEnvVars.id, id),
          isNull(projectEnvVars.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

/** Find the active row for a given (project, key) pair — used to detect upserts. */
export async function findActiveEnvVar(
  workspaceId: string,
  projectId: string,
  key: string,
): Promise<ProjectEnvVar | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(projectEnvVars)
      .where(
        and(
          eq(projectEnvVars.workspaceId, workspaceId),
          eq(projectEnvVars.projectId, projectId),
          eq(projectEnvVars.key, key),
          isNull(projectEnvVars.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function insertEnvVar(row: NewProjectEnvVar): Promise<ProjectEnvVar> {
  return withWorkspace(row.workspaceId, async (tx) => {
    const [r] = await tx.insert(projectEnvVars).values(row).returning();
    if (!r) throw new Error("insertEnvVar returned no row");
    return r;
  });
}

/** Patch vercelEnvId onto a freshly-created row after the Vercel call returns. */
export async function setVercelEnvId(
  workspaceId: string,
  id: string,
  vercelEnvId: string,
): Promise<void> {
  return withWorkspace(workspaceId, async (tx) => {
    await tx
      .update(projectEnvVars)
      .set({ vercelEnvId, updatedAt: new Date() })
      .where(
        and(eq(projectEnvVars.workspaceId, workspaceId), eq(projectEnvVars.id, id)),
      );
  });
}

export async function softDeleteEnvVar(workspaceId: string, id: string): Promise<void> {
  return withWorkspace(workspaceId, async (tx) => {
    await tx
      .update(projectEnvVars)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(projectEnvVars.workspaceId, workspaceId),
          eq(projectEnvVars.id, id),
          isNull(projectEnvVars.deletedAt),
        ),
      );
  });
}
