import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { deployments } from "@/server/db/schema";
import { inArray, and, lt, count } from "drizzle-orm";
import { logger } from "@/server/security/logger";

export const healthRoutes = new Hono();

const NON_TERMINAL = ["queued", "provisioning", "building"] as const;
const STUCK_THRESHOLD_MS = 1000 * 60 * 30; // 30 min

/**
 * Liveness + readiness probe.
 *
 * Returns 200 when DB is reachable. The `stuckDeployments` counter feeds into
 * any alerting system (Datadog, Grafana, PagerDuty) watching this endpoint.
 * Non-zero → oncall should check the reconciler logs.
 */
healthRoutes.get("/", async (c) => {
  const checks: Record<string, "ok" | "error"> = {};
  let stuckCount = 0;

  // 1. Database ping
  try {
    await db.execute(sql`SELECT 1`);
    checks.db = "ok";
  } catch (err) {
    checks.db = "error";
    logger.error({ err }, "health.db_ping_failed");
    return c.json({ ok: false, checks, stuckDeployments: 0 }, 503);
  }

  // 2. Count deployments stuck in non-terminal states past the threshold.
  try {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const [row] = await db
      .select({ n: count() })
      .from(deployments)
      .where(
        and(
          inArray(deployments.status, [...NON_TERMINAL]),
          lt(deployments.createdAt, cutoff),
        ),
      );
    stuckCount = Number(row?.n ?? 0);
    checks.stuckDeployments = stuckCount === 0 ? "ok" : "error";

    if (stuckCount > 0) {
      logger.warn({ stuckCount }, "health.stuck_deployments_detected");
    }
  } catch (err) {
    checks.stuckDeployments = "error";
    logger.error({ err }, "health.stuck_count_failed");
  }

  return c.json({ ok: true, checks, stuckDeployments: stuckCount });
});

/**
 * RLS audit endpoint — protected by ADMIN_SECRET header.
 * POST /api/admin/rls-audit
 */
healthRoutes.post("/rls-audit", async (c) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || c.req.header("x-admin-secret") !== secret) {
    return c.json({ error: "forbidden" }, 403);
  }

  const { runRlsAudit } = await import("@/server/security/rls-audit");
  const result = await runRlsAudit();
  return c.json(result, result.ok ? 200 : 500);
});
