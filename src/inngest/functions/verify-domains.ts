import "server-only";
import { cron } from "inngest";
import { inngest } from "../client";
import { reconcileUnverifiedDomains } from "@/server/services/domains.service";

/**
 * Every 15 minutes: poll Vercel for all unverified domains and mark any that
 * have passed DNS verification. Idempotent — safe to run multiple times.
 */
export const verifyDomains = inngest.createFunction(
  {
    id: "verify-domains",
    name: "Verify pending custom domains",
    triggers: [cron("*/15 * * * *")],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ step }) => step.run("sweep", () => reconcileUnverifiedDomains()),
);
