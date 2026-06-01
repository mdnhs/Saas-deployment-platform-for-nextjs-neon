import { sql } from "drizzle-orm";
import { db, type Db } from "./client";

/**
 * Run `fn` inside a transaction with the tenant GUC set so RLS policies fire.
 * The GUC scope is the transaction, so it auto-clears on commit/rollback.
 *
 * Pair this with repository-layer `WHERE workspace_id = ?` clauses — RLS is the
 * second wall, never the only one. Invariant #2 in AGENTS.md.
 */
export async function withWorkspace<T>(
  workspaceId: string,
  fn: (tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  if (!isUuid(workspaceId)) {
    throw new Error(`withWorkspace: invalid workspaceId ${workspaceId}`);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`);
    return fn(tx);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
