import "server-only";
import {
  detachVercelProjectId,
  findCleanupCandidates,
  hardDeleteProject,
} from "@/server/repositories/projects.repo";
import { vercel, VercelIntegrationError } from "@/server/integrations/vercel";
import { logger } from "@/server/security/logger";

const GRACE_MS = 1000 * 60 * 60 * 24; // 24h grace so accidental deletes can be reversed.

interface CleanupSummary {
  scanned: number;
  externalsTornDown: number;
  hardDeleted: number;
  errors: number;
}

/**
 * Process soft-deleted projects past the grace period:
 *   1. Tear down the Vercel project (404 = already gone, treated as success).
 *   2. Detach the external ID so a partial failure doesn't re-tear-down on retry.
 *   3. Hard delete the row. FK cascades drop deployments + resource_events.
 *
 * Invariant #8: externals first, then the row. The opposite ordering orphans a
 * paid Vercel project the user can no longer see.
 */
export async function runProjectCleanup(): Promise<CleanupSummary> {
  const cutoff = new Date(Date.now() - GRACE_MS);
  const candidates = await findCleanupCandidates({ cutoff, limit: 50 });
  const summary: CleanupSummary = {
    scanned: candidates.length,
    externalsTornDown: 0,
    hardDeleted: 0,
    errors: 0,
  };

  for (const project of candidates) {
    try {
      if (project.vercelProjectId) {
        await vercel.deleteProject({
          vercelProjectId: project.vercelProjectId,
          workspaceId: project.workspaceId,
        });
        summary.externalsTornDown++;
        await detachVercelProjectId(project.workspaceId, project.id);
      }
      await hardDeleteProject(project.workspaceId, project.id);
      summary.hardDeleted++;
    } catch (err) {
      summary.errors++;
      const message =
        err instanceof VercelIntegrationError
          ? `vercel:${err.code}`
          : err instanceof Error
            ? err.message
            : String(err);
      logger.warn(
        { projectId: project.id, workspaceId: project.workspaceId, err: message },
        "cleanup.project_failed",
      );
    }
  }

  logger.info(summary, "cleanup.sweep_done");
  return summary;
}
