import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects, deployments, credentials } from "@/server/db/schema";
import { logger } from "./logger";

/**
 * RLS cross-tenant isolation probe.
 *
 * Picks two real workspace IDs from the DB and verifies that setting the GUC
 * to workspace A returns zero rows from workspace B's data, and vice-versa.
 * Runs entirely inside transactions; no mutations; safe in production.
 *
 * Invoke from /api/admin/rls-audit (protected by ADMIN_SECRET) or via an
 * Inngest event for CI-triggered audits.
 */
export async function runRlsAudit(): Promise<RlsAuditResult> {
  const findings: RlsAuditFinding[] = [];

  // Pull two distinct workspace IDs to test isolation between them.
  const workspaceRows = await db.execute<{ id: string }>(
    sql`SELECT id FROM workspaces ORDER BY created_at LIMIT 2`,
  );
  const ids = workspaceRows.rows.map((r) => r.id as string);

  if (ids.length < 2) {
    return { ok: true, findings: [], note: "fewer than 2 workspaces — skipping cross-tenant check" };
  }

  const [wsA, wsB] = ids as [string, string];

  // For each table, set GUC = wsA, then count rows belonging to wsB.
  // If RLS is working, we expect 0. Any positive count is a breach.
  const checks: Array<{ label: string; query: (gucWorkspaceId: string, targetWorkspaceId: string) => Promise<number> }> = [
    {
      label: "projects",
      query: (guc, target) => countOtherTenant(guc, target, "projects", "workspace_id"),
    },
    {
      label: "deployments",
      query: (guc, target) => countOtherTenant(guc, target, "deployments", "workspace_id"),
    },
    {
      label: "credentials",
      query: (guc, target) => countOtherTenant(guc, target, "credentials", "workspace_id"),
    },
    {
      label: "databases",
      query: (guc, target) => countOtherTenant(guc, target, "databases", "workspace_id"),
    },
    {
      label: "domains",
      query: (guc, target) => countOtherTenant(guc, target, "domains", "workspace_id"),
    },
    {
      label: "subscriptions",
      query: (guc, target) => countOtherTenant(guc, target, "subscriptions", "workspace_id"),
    },
  ];

  for (const check of checks) {
    // Test A → B
    const abCount = await check.query(wsA, wsB);
    if (abCount > 0) {
      findings.push({ table: check.label, gucWorkspace: wsA, leakedWorkspace: wsB, leakedRows: abCount });
      logger.error(
        { table: check.label, gucWorkspace: wsA, leakedWorkspace: wsB, leakedRows: abCount },
        "rls_audit.BREACH_DETECTED",
      );
    }

    // Test B → A
    const baCount = await check.query(wsB, wsA);
    if (baCount > 0) {
      findings.push({ table: check.label, gucWorkspace: wsB, leakedWorkspace: wsA, leakedRows: baCount });
      logger.error(
        { table: check.label, gucWorkspace: wsB, leakedWorkspace: wsA, leakedRows: baCount },
        "rls_audit.BREACH_DETECTED",
      );
    }
  }

  const ok = findings.length === 0;
  if (ok) {
    logger.info({ tables: checks.map((c) => c.label) }, "rls_audit.passed");
  } else {
    logger.error({ findings }, "rls_audit.FAILED");
  }

  return { ok, findings };
}

async function countOtherTenant(
  gucWorkspaceId: string,
  targetWorkspaceId: string,
  table: string,
  column: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${gucWorkspaceId}, true)`);
    const result = await tx.execute<{ n: string }>(
      sql.raw(`SELECT COUNT(*) as n FROM ${table} WHERE ${column} = '${targetWorkspaceId}'`),
    );
    return Number(result.rows[0]?.n ?? 0);
  });
}

export interface RlsAuditFinding {
  table: string;
  gucWorkspace: string;
  leakedWorkspace: string;
  leakedRows: number;
}

export interface RlsAuditResult {
  ok: boolean;
  findings: RlsAuditFinding[];
  note?: string;
}
