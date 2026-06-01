import { Inngest, eventType, staticSchema } from "inngest";

/**
 * Single source of truth for background-job event shapes. Server Actions publish
 * with `inngest.send(provisionDeploymentRequested.with({...}))` and workers
 * register against the same trigger — renames break the build, not prod.
 */
export const provisionDeploymentRequested = eventType("deployment/provision.requested", {
  schema: staticSchema<{
    deploymentId: string;
    workspaceId: string;
    projectId: string;
    idempotencyKey: string;
    commitSha?: string;
    branch?: string;
  }>(),
});

export const inngest = new Inngest({
  id: "deployment-platform",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  isDev: process.env.NODE_ENV !== "production" && !process.env.INNGEST_SIGNING_KEY,
});
