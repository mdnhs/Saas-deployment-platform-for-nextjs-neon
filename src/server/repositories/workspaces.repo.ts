import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import { workspaceMembers, workspaces } from "@/server/db/schema";

/**
 * Memberships are read without RLS (untenanted) because the very purpose of this
 * query is to discover *which* workspaces a user belongs to. The user identity
 * has already been verified by requireWorkspace()'s caller.
 */
export async function findMembershipsForUser(userId: string) {
  return db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      slug: workspaces.slug,
      name: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));
}

export async function findMembership(workspaceId: string, userId: string) {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function findWorkspaceBySlug(slug: string) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertWorkspaceWithOwner(input: {
  name: string;
  slug: string;
  ownerId: string;
}) {
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: input.name, slug: input.slug, ownerId: input.ownerId })
      .returning();
    if (!workspace) throw new Error("insertWorkspace returned no row");

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: input.ownerId,
      role: "owner",
    });

    return workspace;
  });
}

void isNull;
