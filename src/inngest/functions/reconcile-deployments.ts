import "server-only";
import { cron } from "inngest";
import { inngest } from "../client";
import { reconcileStuckDeployments } from "@/server/services/reconciler.service";

/**
 * Hourly reconciliation sweep. We could poll faster, but the state machine plus
 * Vercel webhooks already drive the happy path — this only catches drift. The
 * reconciler is idempotent (driven by `transitionDeployment()`'s state checks),
 * so cron overlap or manual triggers are safe.
 */
export const reconcileDeployments = inngest.createFunction(
  {
    id: "reconcile-deployments",
    name: "Reconcile stuck deployments",
    triggers: [cron("0 * * * *")],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ step }) => step.run("sweep", () => reconcileStuckDeployments()),
);
