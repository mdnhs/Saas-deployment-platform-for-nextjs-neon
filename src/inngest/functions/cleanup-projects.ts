import "server-only";
import { cron } from "inngest";
import { inngest } from "../client";
import { runProjectCleanup } from "@/server/services/cleanup.service";

/**
 * Daily cleanup at 04:10 UTC — outside US business hours, well clear of the
 * hourly reconciler sweep. Externals are torn down first, then rows.
 */
export const cleanupProjects = inngest.createFunction(
  {
    id: "cleanup-projects",
    name: "Cleanup soft-deleted projects",
    triggers: [cron("10 4 * * *")],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ step }) => step.run("sweep", () => runProjectCleanup()),
);
