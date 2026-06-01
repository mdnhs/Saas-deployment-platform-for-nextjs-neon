import "server-only";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import {
  credentials,
  type Credential,
  type CredentialKind,
  type CredentialProvider,
  type NewCredential,
} from "@/server/db/schema";

interface Filter {
  workspaceId: string;
  provider: CredentialProvider;
  kind: CredentialKind;
}

export async function findActiveCredential(filter: Filter): Promise<Credential | null> {
  return withWorkspace(filter.workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(credentials)
      .where(
        and(
          eq(credentials.workspaceId, filter.workspaceId),
          eq(credentials.provider, filter.provider),
          eq(credentials.kind, filter.kind),
          isNull(credentials.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listCredentialsForWorkspace(workspaceId: string) {
  return withWorkspace(workspaceId, (tx) =>
    tx
      .select({
        id: credentials.id,
        provider: credentials.provider,
        kind: credentials.kind,
        metadata: credentials.metadata,
        createdAt: credentials.createdAt,
        rotatedAt: credentials.rotatedAt,
      })
      .from(credentials)
      .where(
        and(
          eq(credentials.workspaceId, workspaceId),
          isNull(credentials.deletedAt),
        ),
      ),
  );
}

export async function insertCredential(row: NewCredential): Promise<Credential> {
  return withWorkspace(row.workspaceId, async (tx) => {
    const [r] = await tx.insert(credentials).values(row).returning();
    if (!r) throw new Error("insertCredential returned no row");
    return r;
  });
}

/**
 * Replace an active credential atomically: soft-delete the existing one (if
 * any) and insert the new one in the same transaction so the
 * `credentials_active_unique` partial index never sees two active rows.
 */
export async function rotateCredential(input: {
  workspaceId: string;
  provider: CredentialProvider;
  kind: CredentialKind;
  newRow: NewCredential;
}): Promise<Credential> {
  return withWorkspace(input.workspaceId, async (tx) => {
    await tx
      .update(credentials)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(credentials.workspaceId, input.workspaceId),
          eq(credentials.provider, input.provider),
          eq(credentials.kind, input.kind),
          isNull(credentials.deletedAt),
        ),
      );
    const [r] = await tx.insert(credentials).values(input.newRow).returning();
    if (!r) throw new Error("rotateCredential: insert returned no row");
    return r;
  });
}

/**
 * Find active credentials sealed under a key version older than `currentVersion`.
 * Used by the rotation job to re-seal stale rows. Untenanted — runs platform-wide.
 */
export async function findStaleCredentials(input: {
  currentVersion: number;
  limit?: number;
}): Promise<Credential[]> {
  return db
    .select()
    .from(credentials)
    .where(
      and(
        isNull(credentials.deletedAt),
        lt(credentials.keyVersion, input.currentVersion),
      ),
    )
    .limit(input.limit ?? 50);
}

export async function softDeleteCredential(workspaceId: string, credentialId: string) {
  return withWorkspace(workspaceId, async (tx) => {
    await tx
      .update(credentials)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(credentials.workspaceId, workspaceId),
          eq(credentials.id, credentialId),
        ),
      );
  });
}
