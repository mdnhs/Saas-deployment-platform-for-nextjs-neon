import "server-only";
import { eq, and, isNull, count } from "drizzle-orm";
import { db } from "@/server/db/client";
import { withWorkspace } from "@/server/db/tenant";
import { domains, type Domain, type NewDomain, type VercelVerificationRecord } from "@/server/db/schema";

export async function insertDomain(
  input: Omit<NewDomain, "id" | "createdAt">,
): Promise<Domain> {
  const [row] = await withWorkspace(input.workspaceId, (tx) =>
    tx.insert(domains).values(input).returning(),
  );
  return row!;
}

export async function listDomainsForProject(input: {
  workspaceId: string;
  projectId: string;
}): Promise<Domain[]> {
  return withWorkspace(input.workspaceId, (tx) =>
    tx
      .select()
      .from(domains)
      .where(
        and(
          eq(domains.workspaceId, input.workspaceId),
          eq(domains.projectId, input.projectId),
          isNull(domains.deletedAt),
        ),
      )
      .orderBy(domains.createdAt),
  );
}

export async function findDomainById(input: {
  workspaceId: string;
  domainId: string;
}): Promise<Domain | undefined> {
  const [row] = await withWorkspace(input.workspaceId, (tx) =>
    tx
      .select()
      .from(domains)
      .where(
        and(
          eq(domains.workspaceId, input.workspaceId),
          eq(domains.id, input.domainId),
          isNull(domains.deletedAt),
        ),
      )
      .limit(1),
  );
  return row;
}

export async function countActiveDomainsForWorkspace(workspaceId: string): Promise<number> {
  const [row] = await withWorkspace(workspaceId, (tx) =>
    tx
      .select({ n: count() })
      .from(domains)
      .where(and(eq(domains.workspaceId, workspaceId), isNull(domains.deletedAt))),
  );
  return Number(row?.n ?? 0);
}

export async function listUnverifiedDomains(): Promise<Domain[]> {
  // Called by the reconciler — no workspace GUC needed (superuser context).
  return db
    .select()
    .from(domains)
    .where(and(isNull(domains.verifiedAt), isNull(domains.deletedAt)));
}

export async function markDomainVerified(input: {
  workspaceId: string;
  domainId: string;
}): Promise<void> {
  await withWorkspace(input.workspaceId, (tx) =>
    tx
      .update(domains)
      .set({ verifiedAt: new Date() })
      .where(
        and(
          eq(domains.workspaceId, input.workspaceId),
          eq(domains.id, input.domainId),
        ),
      ),
  );
}

export async function updateDomainVerification(input: {
  workspaceId: string;
  domainId: string;
  vercelVerification: VercelVerificationRecord[];
}): Promise<void> {
  await withWorkspace(input.workspaceId, (tx) =>
    tx
      .update(domains)
      .set({ vercelVerification: input.vercelVerification })
      .where(
        and(
          eq(domains.workspaceId, input.workspaceId),
          eq(domains.id, input.domainId),
        ),
      ),
  );
}

export async function softDeleteDomain(input: {
  workspaceId: string;
  domainId: string;
}): Promise<void> {
  await withWorkspace(input.workspaceId, (tx) =>
    tx
      .update(domains)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(domains.workspaceId, input.workspaceId),
          eq(domains.id, input.domainId),
        ),
      ),
  );
}
