import "server-only";
import {
  attachVercelDeploymentId,
  findDeploymentByIdempotency,
} from "@/server/repositories/deployments.repo";
import { findProjectById } from "@/server/repositories/projects.repo";
import { transitionDeployment } from "@/server/domain/transition-deployment";
import { vercel, VercelIntegrationError } from "@/server/integrations/vercel";
import { logger } from "@/server/security/logger";

interface ProvisionInput {
  deploymentId: string;
  workspaceId: string;
  projectId: string;
  idempotencyKey: string;
  commitSha?: string;
  branch?: string;
  actor: string;
}

/**
 * Pure provisioning path: dedupe → transition to provisioning → ask Vercel to
 * deploy → attach external id. Used by both the Inngest worker (with step.run
 * checkpoints) and the inline fallback when Inngest dev isn't running.
 *
 * Safe to call multiple times: idempotency dedupe on the deployment row, and
 * `transitionDeployment()` no-ops on `from===to`.
 */
export async function provisionDeploymentNow(input: ProvisionInput) {
  const dedupe = await findDeploymentByIdempotency(input.workspaceId, input.idempotencyKey);
  if (!dedupe || dedupe.id !== input.deploymentId) {
    logger.warn(
      { deploymentId: input.deploymentId, idempotencyKey: input.idempotencyKey },
      "provision.dedupe.mismatch",
    );
    return { skipped: true as const, reason: "idempotency mismatch" };
  }

  const project = await findProjectById(input.workspaceId, input.projectId);
  if (!project) throw new Error(`project ${input.projectId} not found`);
  if (!project.vercelProjectId) {
    throw new Error(`project ${project.id} has no vercel_project_id — connect step missing`);
  }

  await transitionDeployment({
    deploymentId: input.deploymentId,
    workspaceId: input.workspaceId,
    to: "provisioning",
    actor: input.actor,
    payload: { commitSha: input.commitSha, branch: input.branch },
  });

  try {
    // v13/deployments needs the numeric GitHub repo id (`gitSource.repoId`),
    // not the "owner/repo" string. Vercel stored it on the project at connect
    // time — fetch it back rather than tracking it ourselves so we stay in
    // sync if the user reconnects the repo on Vercel's side.
    const vProject = await vercel.getProject({
      vercelProjectId: project.vercelProjectId,
      workspaceId: input.workspaceId,
    });
    const repoId = vProject.link?.repoId;
    if (typeof repoId !== "number") {
      throw new Error(
        `Vercel project ${project.vercelProjectId} has no linked git repo (link.repoId missing) — reconnect the repo in Vercel`,
      );
    }

    const vercelDeployment = await vercel.createDeployment({
      projectId: project.vercelProjectId,
      projectName: vProject.name,
      repoId,
      gitBranch: input.branch ?? project.githubDefaultBranch,
      commitSha: input.commitSha,
      idempotencyKey: input.idempotencyKey,
      workspaceId: input.workspaceId,
    });

    await attachVercelDeploymentId({
      workspaceId: input.workspaceId,
      deploymentId: input.deploymentId,
      vercelDeploymentId: vercelDeployment.id,
    });

    return { skipped: false as const, vercelDeploymentId: vercelDeployment.id };
  } catch (err) {
    // Vercel call failed. Push the deployment to `failed` so the user sees it,
    // and so the reconciler doesn't keep polling a phantom external resource.
    const reason =
      err instanceof VercelIntegrationError ? `vercel:${err.code}` : "vercel:unknown";
    await transitionDeployment({
      deploymentId: input.deploymentId,
      workspaceId: input.workspaceId,
      to: "failed",
      actor: input.actor,
      payload: { reason, message: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}
