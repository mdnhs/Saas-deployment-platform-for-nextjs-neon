import "server-only";
import { inngest, provisionDeploymentRequested } from "../client";
import { provisionDeploymentNow } from "@/server/services/provision-deployment.service";

/**
 * Inngest wrapper around `provisionDeploymentNow`. The pure service is also
 * called inline by the Server Action as a fallback when the Inngest dev server
 * isn't running (free-plan / local dev without `inngest-cli`).
 */
export const provisionDeployment = inngest.createFunction(
  {
    id: "provision-deployment",
    name: "Provision deployment",
    triggers: [provisionDeploymentRequested],
    retries: 3,
    concurrency: { limit: 10 },
  },
  async ({ event, step }) => {
    const { deploymentId, workspaceId, projectId, idempotencyKey, commitSha, branch } =
      event.data;
    return step.run("provision", () =>
      provisionDeploymentNow({
        deploymentId,
        workspaceId,
        projectId,
        idempotencyKey,
        commitSha,
        branch,
        actor: "inngest:provision-deployment",
      }),
    );
  },
);
