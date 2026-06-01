import "server-only";
import { findStuckDeployments } from "@/server/repositories/deployments.repo";
import { findProjectById } from "@/server/repositories/projects.repo";
import { transitionDeployment } from "@/server/domain/transition-deployment";
import { vercel, VercelIntegrationError } from "@/server/integrations/vercel";
import type { DeploymentStatus } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

const STUCK_AFTER_MS = 1000 * 60 * 10; // 10 minutes; tune once we have real timing data.
const STARVED_AFTER_MS = 1000 * 60 * 60; // 60 minutes — force-cancel after this.

/**
 * Map Vercel's `readyState` strings to our `DeploymentStatus`. Vercel uses
 * uppercase historically; lowercase shows up too on newer endpoints. Match
 * permissively.
 */
function mapVercelReadyState(readyState: string | undefined): DeploymentStatus | null {
  switch ((readyState ?? "").toUpperCase()) {
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

interface ReconcileSummary {
  scanned: number;
  advanced: number;
  canceled: number;
  failed: number;
  errors: number;
}

/**
 * Scan for deployments stuck in a non-terminal status past the timeout, poll
 * Vercel directly, and drive `transitionDeployment()` to the right terminal
 * state. Catches webhook drops, partial failures, and any external state we
 * never heard back about.
 *
 * Anything stuck past STARVED_AFTER_MS is force-canceled — better to surface a
 * loud failure than leave a row dangling forever.
 */
export async function reconcileStuckDeployments(): Promise<ReconcileSummary> {
  const now = Date.now();
  const cutoff = new Date(now - STUCK_AFTER_MS);
  const starvedCutoff = new Date(now - STARVED_AFTER_MS);

  const stuck = await findStuckDeployments({ olderThan: cutoff, limit: 100 });
  const summary: ReconcileSummary = {
    scanned: stuck.length,
    advanced: 0,
    canceled: 0,
    failed: 0,
    errors: 0,
  };

  for (const dep of stuck) {
    try {
      // If the deployment never even got a Vercel ID (worker crashed mid-step
      // OR Vercel rejected our request), force-fail. We don't have anything to
      // poll, so we can't recover.
      if (!dep.vercelDeploymentId) {
        if (dep.createdAt < starvedCutoff) {
          await transitionDeployment({
            deploymentId: dep.id,
            workspaceId: dep.workspaceId,
            to: "failed",
            actor: "reconciler",
            payload: { reason: "no vercel_deployment_id past starvation threshold" },
          });
          summary.failed++;
        }
        continue;
      }

      // Confirm the project still has a Vercel project id (defensive — soft
      // deletes should have torn this down).
      const project = await findProjectById(dep.workspaceId, dep.projectId);
      if (!project || !project.vercelProjectId) {
        await transitionDeployment({
          deploymentId: dep.id,
          workspaceId: dep.workspaceId,
          to: "failed",
          actor: "reconciler",
          payload: { reason: "project missing or unconnected" },
        });
        summary.failed++;
        continue;
      }

      const remote = await vercel.getDeployment({
        vercelDeploymentId: dep.vercelDeploymentId,
        workspaceId: dep.workspaceId,
      });
      const mapped = mapVercelReadyState(remote.readyState);

      if (mapped && mapped !== dep.status) {
        await transitionDeployment({
          deploymentId: dep.id,
          workspaceId: dep.workspaceId,
          to: mapped,
          actor: "reconciler",
          payload: { vercelReadyState: remote.readyState },
        });
        summary.advanced++;
        continue;
      }

      // Still in flight per Vercel — only force-cancel once past the starvation
      // threshold to give long builds room.
      if (dep.createdAt < starvedCutoff) {
        await transitionDeployment({
          deploymentId: dep.id,
          workspaceId: dep.workspaceId,
          to: "canceled",
          actor: "reconciler",
          payload: { reason: "starved past threshold", vercelReadyState: remote.readyState },
        });
        summary.canceled++;
      }
    } catch (err) {
      summary.errors++;
      // Permission/credential errors are reported but don't fail the whole sweep;
      // the next run picks up where we left off.
      const message =
        err instanceof VercelIntegrationError
          ? `vercel:${err.code}`
          : err instanceof Error
            ? err.message
            : String(err);
      logger.warn({ deploymentId: dep.id, err: message }, "reconciler.deployment_failed");
    }
  }

  logger.info(summary, "reconciler.sweep_done");

  // Alert when a significant fraction of scanned rows couldn't be resolved.
  // Wire this log line into your observability platform (Datadog, Grafana, etc.)
  // via a log-based metric or alert on `reconciler.high_error_rate`.
  if (summary.scanned > 0 && summary.errors / summary.scanned > 0.2) {
    logger.error(
      { ...summary, errorRate: (summary.errors / summary.scanned).toFixed(2) },
      "reconciler.high_error_rate",
    );
  }

  // Surface stuck deployments count as a structured metric for monitoring.
  logger.info({ stuck: summary.scanned }, "metric.stuck_deployments");

  return summary;
}
