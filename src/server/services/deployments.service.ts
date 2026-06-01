import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  findDeploymentByIdempotency,
  insertDeployment,
} from "@/server/repositories/deployments.repo";
import { findProjectById } from "@/server/repositories/projects.repo";
import { transitionDeployment } from "@/server/domain/transition-deployment";
import { inngest, provisionDeploymentRequested } from "@/inngest/client";
import { provisionDeploymentNow } from "@/server/services/provision-deployment.service";
import { assertWithinLimit, recordUsage, BillingError } from "@/server/services/billing.service";
import { logger } from "@/server/security/logger";

export class DeploymentServiceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "PROJECT_NOT_FOUND"
      | "PROJECT_NOT_CONNECTED"
      | "PLAN_LIMIT_EXCEEDED",
    message: string,
  ) {
    super(message);
    this.name = "DeploymentServiceError";
  }
}

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().min(1),
  idempotencyKey: z.string().uuid().optional(),
  commitSha: z.string().regex(/^[a-f0-9]{7,40}$/i).optional(),
  branch: z.string().min(1).max(255).optional(),
});

/**
 * Create a deployment in `queued` state, attach an idempotency key, emit the
 * Inngest event, and return immediately. Only the worker (then the webhook)
 * advances status — Invariant #1.
 *
 * Idempotency: if a deployment with the same `(workspace_id, idempotency_key)`
 * already exists, return it without queueing again — double-clicks and form
 * resubmits become no-ops. Invariant #5.
 */
export async function createDeployment(input: z.input<typeof inputSchema>) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new DeploymentServiceError("INVALID_INPUT", parsed.error.message);

  const idempotencyKey = parsed.data.idempotencyKey ?? randomUUID();

  const existing = await findDeploymentByIdempotency(parsed.data.workspaceId, idempotencyKey);
  if (existing) {
    logger.info(
      { deploymentId: existing.id, idempotencyKey },
      "deployment.create.idempotent_hit",
    );
    return existing;
  }

  const project = await findProjectById(parsed.data.workspaceId, parsed.data.projectId);
  if (!project) throw new DeploymentServiceError("PROJECT_NOT_FOUND", "project not found");
  if (!project.vercelProjectId) {
    throw new DeploymentServiceError(
      "PROJECT_NOT_CONNECTED",
      "project has no Vercel project id; reconnect repo",
    );
  }

  try {
    await assertWithinLimit({ workspaceId: parsed.data.workspaceId, metric: "deploymentsPerMonth" });
  } catch (err) {
    if (err instanceof BillingError) throw new DeploymentServiceError("PLAN_LIMIT_EXCEEDED", err.message);
    throw err;
  }

  const deployment = await insertDeployment({
    workspaceId: parsed.data.workspaceId,
    projectId: parsed.data.projectId,
    status: "queued",
    idempotencyKey,
    commitSha: parsed.data.commitSha,
    branch: parsed.data.branch ?? project.githubDefaultBranch,
    createdBy: parsed.data.userId,
  });

  // Record the creation in the audit log. We deliberately use the state
  // machine's no-op path (queued → queued) so the only writer to
  // `deployments.status` remains `transitionDeployment()`. Invariant #4.
  await transitionDeployment({
    deploymentId: deployment.id,
    workspaceId: deployment.workspaceId,
    to: "queued",
    actor: `user:${parsed.data.userId}`,
    payload: { kind: "created", commitSha: parsed.data.commitSha, branch: parsed.data.branch },
  });

  // Record usage before dispatching so the ledger is consistent even if Inngest
  // delivery fails. Errors here are non-fatal — a missed usage record is a
  // billing gap, not a product failure.
  recordUsage({
    workspaceId: deployment.workspaceId,
    metric: "deployment",
    metadata: { projectId: deployment.projectId, deploymentId: deployment.id },
  }).catch((err: unknown) =>
    logger.warn({ err, deploymentId: deployment.id }, "deployment.usage_record_failed"),
  );

  const sendResult = await inngest
    .send(
      provisionDeploymentRequested.create({
        deploymentId: deployment.id,
        workspaceId: deployment.workspaceId,
        projectId: deployment.projectId,
        idempotencyKey,
        commitSha: parsed.data.commitSha,
        branch: deployment.branch ?? project.githubDefaultBranch,
      }),
    )
    .then(() => ({ ok: true as const }))
    .catch((err: unknown) => ({ ok: false as const, err }));

  if (!sendResult.ok) {
    // Inngest dev server isn't running (or unreachable). Fall back to running
    // the worker logic inline — costs a slower Server Action but keeps the
    // deploy loop functional in dev and on Vercel free plans. The reconciler
    // still owns recovery from partial failures of the inline path.
    logger.warn(
      {
        deploymentId: deployment.id,
        err: sendResult.err instanceof Error ? sendResult.err.message : "send failed",
      },
      "deployment.inngest_unavailable.falling_back_inline",
    );
    try {
      await provisionDeploymentNow({
        deploymentId: deployment.id,
        workspaceId: deployment.workspaceId,
        projectId: deployment.projectId,
        idempotencyKey,
        commitSha: parsed.data.commitSha,
        branch: deployment.branch ?? project.githubDefaultBranch,
        actor: `user:${parsed.data.userId}:inline-fallback`,
      });
    } catch (err) {
      logger.error(
        { deploymentId: deployment.id, err: err instanceof Error ? err.message : String(err) },
        "deployment.inline_fallback_failed",
      );
      // Don't surface this as a Server Action failure — the deployment row is
      // in `failed` state (set by provisionDeploymentNow's catch), so the user
      // sees it in the UI. Reconciler will not retry terminal rows.
    }
  }

  logger.info(
    { deploymentId: deployment.id, projectId: deployment.projectId, idempotencyKey },
    "deployment.created",
  );
  return deployment;
}
