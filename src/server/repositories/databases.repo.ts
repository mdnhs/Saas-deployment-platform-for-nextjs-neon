import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { withWorkspace } from "@/server/db/tenant";
import {
  databases,
  type Database,
  type NewDatabase,
} from "@/server/db/schema";

export async function listDatabasesForProject(input: {
  workspaceId: string;
  projectId: string;
}): Promise<Database[]> {
  return withWorkspace(input.workspaceId, (tx) =>
    tx
      .select()
      .from(databases)
      .where(
        and(
          eq(databases.workspaceId, input.workspaceId),
          eq(databases.projectId, input.projectId),
          isNull(databases.deletedAt),
        ),
      )
      .orderBy(desc(databases.createdAt)),
  );
}

export async function insertDatabase(input: NewDatabase): Promise<Database> {
  return withWorkspace(input.workspaceId, async (tx) => {
    const [r] = await tx.insert(databases).values(input).returning();
    if (!r) throw new Error("insertDatabase returned no row");
    return r;
  });
}

export async function markDatabaseReady(input: {
  workspaceId: string;
  databaseId: string;
}) {
  return withWorkspace(input.workspaceId, async (tx) => {
    await tx
      .update(databases)
      .set({ status: "ready" })
      .where(
        and(
          eq(databases.workspaceId, input.workspaceId),
          eq(databases.id, input.databaseId),
        ),
      );
  });
}

export async function markDatabaseFailed(input: {
  workspaceId: string;
  databaseId: string;
}) {
  return withWorkspace(input.workspaceId, async (tx) => {
    await tx
      .update(databases)
      .set({ status: "failed" })
      .where(
        and(
          eq(databases.workspaceId, input.workspaceId),
          eq(databases.id, input.databaseId),
        ),
      );
  });
}

export async function attachNeonIdentifiers(input: {
  workspaceId: string;
  databaseId: string;
  neonProjectId: string;
  neonBranchId: string;
  host: string;
  roleName: string;
  databaseName: string;
}) {
  return withWorkspace(input.workspaceId, async (tx) => {
    await tx
      .update(databases)
      .set({
        neonProjectId: input.neonProjectId,
        neonBranchId: input.neonBranchId,
        host: input.host,
        roleName: input.roleName,
        databaseName: input.databaseName,
      })
      .where(
        and(
          eq(databases.workspaceId, input.workspaceId),
          eq(databases.id, input.databaseId),
        ),
      );
  });
}

export async function countActiveDatabasesForWorkspace(workspaceId: string): Promise<number> {
  const [row] = await withWorkspace(workspaceId, (tx) =>
    tx
      .select({ n: count() })
      .from(databases)
      .where(and(eq(databases.workspaceId, workspaceId), isNull(databases.deletedAt))),
  );
  return Number(row?.n ?? 0);
}
