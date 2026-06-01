import "server-only";
import { findDeploymentById } from "@/server/repositories/deployments.repo";
import { transitionDeployment } from "@/server/domain/transition-deployment";
import { vercel, VercelIntegrationError } from "@/server/integrations/vercel";
import type { DeploymentStatus } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

export class RefreshDeploymentError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NO_EXTERNAL_ID" | "VERCEL_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "RefreshDeploymentError";
  }
}

function mapVercelReadyState(state: string | undefined): DeploymentStatus | null {
  switch ((state ?? "").toUpperCase()) {
    case "READY":
      return "ready";
    case "ERROR":
    case "FAILED":
      return "failed";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    case "BUILDING":
      return "building";
    case "INITIALIZING":
    case "QUEUED":
      return "provisioning";
    default:
      return null;
  }
}

/**
 * On-demand poll for a single deployment. Used by the UI "Refresh status"
 * button when webhooks are unavailable (Vercel free plan) or the worker hasn't
 * advanced state yet. Same path as the reconciler — single-row, no scan.
 */
export async function refreshDeploymentStatus(input: {
  workspaceId: string;
  deploymentId: string;
  actor: string;
}) {
  const dep = await findDeploymentById(input.workspaceId, input.deploymentId);
  if (!dep) throw new RefreshDeploymentError("NOT_FOUND", "deployment not found");
  if (!dep.vercelDeploymentId) {
    throw new RefreshDeploymentError(
      "NO_EXTERNAL_ID",
      "deployment has no Vercel id yet — wait for the worker (or check Inngest dev is running)",
    );
  }

  try {
    const remote = await vercel.getDeployment({
      vercelDeploymentId: dep.vercelDeploymentId,
      workspaceId: dep.workspaceId,
    });
    const mapped = mapVercelReadyState(remote.readyState);
    if (!mapped) {
      return { changed: false, status: dep.status, vercelReadyState: remote.readyState };
    }
    const result = await transitionDeployment({
      deploymentId: dep.id,
      workspaceId: dep.workspaceId,
      to: mapped,
      actor: input.actor,
      payload: { source: "manual-refresh", vercelReadyState: remote.readyState },
    });
    return { changed: !result.noop, status: result.to, vercelReadyState: remote.readyState };
  } catch (err) {
    if (err instanceof VercelIntegrationError) {
      logger.warn({ deploymentId: dep.id, err: err.message }, "refresh.vercel_failed");
      throw new RefreshDeploymentError("VERCEL_FAILED", err.message);
    }
    throw err;
  }
}
