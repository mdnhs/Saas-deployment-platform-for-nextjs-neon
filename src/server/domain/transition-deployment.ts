import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  deployments,
  resourceEvents,
  type DeploymentStatus,
} from "@/server/db/schema";
import { canTransition, IllegalDeploymentTransition, isTerminal } from "./deployment-state";
import { logger } from "@/server/security/logger";

interface TransitionInput {
  deploymentId: string;
  workspaceId: string;
  to: DeploymentStatus;
  actor: string;
  payload?: Record<string, unknown>;
}

interface TransitionResult {
  from: DeploymentStatus;
  to: DeploymentStatus;
  noop: boolean;
}

/**
 * The ONLY code path allowed to write `deployments.status`. Invariant #4.
 *
 *  1. Opens a transaction and sets the tenant GUC so RLS fires.
 *  2. `SELECT … FOR UPDATE` on the deployment row — concurrent webhooks serialize.
 *  3. If `from === to`, treat as no-op (duplicate webhook redelivery).
 *  4. If transition isn't allowed, throw — loud failure beats silent drift.
 *  5. Updates the status and, in the same tx, appends to `resource_events`.
 *  6. Stamps `started_at` / `finished_at` on the appropriate transitions.
 */
export async function transitionDeployment(input: TransitionInput): Promise<TransitionResult> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.workspace_id', ${input.workspaceId}, true)`,
    );

    const rows = await tx.execute<{
      id: string;
      status: DeploymentStatus;
    }>(sql`
      SELECT id, status FROM deployments
      WHERE id = ${input.deploymentId} AND workspace_id = ${input.workspaceId}
      FOR UPDATE
    `);
    const row = rows.rows[0];
    if (!row) {
      throw new Error(`deployment ${input.deploymentId} not found in workspace`);
    }

    const from = row.status;
    if (from === input.to) {
      // Idempotent no-op. Still log an event for the audit trail so we can see
      // duplicate webhook redelivery in `resource_events`.
      await tx.insert(resourceEvents).values({
        workspaceId: input.workspaceId,
        resourceType: "deployment",
        resourceId: input.deploymentId,
        fromState: from,
        toState: input.to,
        actor: input.actor,
        payload: { noop: true, ...(input.payload ?? {}) },
      });
      logger.debug(
        { deploymentId: input.deploymentId, status: from, actor: input.actor },
        "deployment.transition.noop",
      );
      return { from, to: input.to, noop: true };
    }

    if (!canTransition(from, input.to)) {
      throw new IllegalDeploymentTransition(from, input.to, input.deploymentId);
    }

    const now = new Date();
    const patch: Partial<typeof deployments.$inferInsert> = { status: input.to };
    if (input.to === "provisioning" && !row.status) {
      patch.startedAt = now;
    }
    if (from === "queued" && input.to === "provisioning") {
      patch.startedAt = now;
    }
    if (isTerminal(input.to)) {
      patch.finishedAt = now;
    }

    await tx
      .update(deployments)
      .set(patch)
      .where(eq(deployments.id, input.deploymentId));

    await tx.insert(resourceEvents).values({
      workspaceId: input.workspaceId,
      resourceType: "deployment",
      resourceId: input.deploymentId,
      fromState: from,
      toState: input.to,
      actor: input.actor,
      payload: input.payload ?? null,
    });

    logger.info(
      { deploymentId: input.deploymentId, from, to: input.to, actor: input.actor },
      "deployment.transition",
    );
    return { from, to: input.to, noop: false };
  });
}
