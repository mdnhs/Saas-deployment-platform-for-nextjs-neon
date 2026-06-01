import "server-only";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import {
  deployments,
  type Deployment,
  type DeploymentStatus,
  type NewDeployment,
} from "@/server/db/schema";

export async function listDeploymentsForProject(input: {
  workspaceId: string;
  projectId: string;
  limit?: number;
}): Promise<Deployment[]> {
  return withWorkspace(input.workspaceId, (tx) =>
    tx
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, input.workspaceId),
          eq(deployments.projectId, input.projectId),
        ),
      )
      .orderBy(desc(deployments.createdAt))
      .limit(input.limit ?? 25),
  );
}

export async function findDeploymentById(workspaceId: string, deploymentId: string) {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, workspaceId),
          eq(deployments.id, deploymentId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function findDeploymentByIdempotency(
  workspaceId: string,
  idempotencyKey: string,
): Promise<Deployment | null> {
  return withWorkspace(workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, workspaceId),
          eq(deployments.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function insertDeployment(input: NewDeployment): Promise<Deployment> {
  return withWorkspace(input.workspaceId, async (tx) => {
    const [row] = await tx.insert(deployments).values(input).returning();
    if (!row) throw new Error("insertDeployment returned no row");
    return row;
  });
}

export async function attachVercelDeploymentId(input: {
  workspaceId: string;
  deploymentId: string;
  vercelDeploymentId: string;
}) {
  return withWorkspace(input.workspaceId, async (tx) => {
    await tx
      .update(deployments)
      .set({ vercelDeploymentId: input.vercelDeploymentId })
      .where(
        and(
          eq(deployments.workspaceId, input.workspaceId),
          eq(deployments.id, input.deploymentId),
        ),
      );
  });
}

/**
 * Resolve a deployment from its Vercel ID. Untenanted because the webhook arrives
 * with only the external ID — the resolved row tells us which workspace to enter.
 */
export async function findDeploymentByVercelId(vercelDeploymentId: string) {
  const rows = await db
    .select()
    .from(deployments)
    .where(eq(deployments.vercelDeploymentId, vercelDeploymentId))
    .limit(1);
  return rows[0] ?? null;
}

const NON_TERMINAL: DeploymentStatus[] = ["queued", "provisioning", "building"];

/**
 * Find deployments that have been stuck in a non-terminal status for too long.
 * Used by the reconciler — these rows lost their webhook (or their worker never
 * finished) and need to be polled directly.
 *
 * Untenanted because the reconciler scans across all workspaces. Each returned
 * row carries `workspace_id`, which the reconciler hands back to
 * `transitionDeployment()` for tenant context.
 */
export async function findStuckDeployments(input: {
  olderThan: Date;
  limit?: number;
}): Promise<Deployment[]> {
  return db
    .select()
    .from(deployments)
    .where(
      and(
        inArray(deployments.status, NON_TERMINAL),
        lt(deployments.createdAt, input.olderThan),
      ),
    )
    .limit(input.limit ?? 100);
}

