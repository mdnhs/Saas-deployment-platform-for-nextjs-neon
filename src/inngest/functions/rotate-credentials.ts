import "server-only";
import { inngest } from "../client";
import { rotateStaleCredentials } from "@/server/services/credential-rotation.service";

/**
 * Master-key rotation job. Triggered manually (Inngest dashboard / `inngest.send`)
 * after a new key version is set and `MASTER_KEY_CURRENT_VERSION` is bumped.
 *
 * Safe to run multiple times: credentials already on the current version are
 * skipped; crashes mid-run leave each row consistent. After all rows are
 * rotated, the old key env var can be removed.
 *
 * NOT on a cron — this is an operator-initiated action, not background drift.
 */
export const rotateCredentials = inngest.createFunction(
  {
    id: "rotate-credentials",
    name: "Rotate stale credential keys",
    triggers: [{ event: "platform/key-rotation.requested" }],
    concurrency: { limit: 1 },
    retries: 2,
  },
  async ({ step }) => step.run("rotate", () => rotateStaleCredentials()),
);
