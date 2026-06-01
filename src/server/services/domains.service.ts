import "server-only";
import { vercel } from "@/server/integrations/vercel";
import { findProjectById } from "@/server/repositories/projects.repo";
import {
  insertDomain,
  findDomainById,
  countActiveDomainsForWorkspace,
  softDeleteDomain,
  markDomainVerified,
  updateDomainVerification,
  listUnverifiedDomains,
} from "@/server/repositories/domains.repo";
import { assertCountLimit, BillingError } from "@/server/services/billing.service";
import { logger } from "@/server/security/logger";
import type { Domain } from "@/server/db/schema";

export class DomainServiceError extends Error {
  constructor(
    public readonly code:
      | "PROJECT_NOT_FOUND"
      | "NO_VERCEL_PROJECT"
      | "DOMAIN_NOT_FOUND"
      | "ALREADY_VERIFIED"
      | "PLAN_LIMIT_EXCEEDED",
    message: string,
  ) {
    super(message);
    this.name = "DomainServiceError";
  }
}

export async function addDomain(input: {
  workspaceId: string;
  projectId: string;
  domain: string;
  createdBy: string;
}): Promise<Domain> {
  const project = await findProjectById(input.workspaceId, input.projectId);
  if (!project) throw new DomainServiceError("PROJECT_NOT_FOUND", "project not found");
  if (!project.vercelProjectId) {
    throw new DomainServiceError("NO_VERCEL_PROJECT", "project has no Vercel project — deploy first");
  }

  const domainCount = await countActiveDomainsForWorkspace(input.workspaceId);
  try {
    await assertCountLimit({ workspaceId: input.workspaceId, metric: "domains", currentCount: domainCount });
  } catch (err) {
    if (err instanceof BillingError) throw new DomainServiceError("PLAN_LIMIT_EXCEEDED", err.message);
    throw err;
  }

  const vercelRecord = await vercel.addDomain({
    vercelProjectId: project.vercelProjectId,
    domain: input.domain,
    workspaceId: input.workspaceId,
  });

  const vercelVerification = vercelRecord.verification
    ? vercelRecord.verification.map((v) => ({
        type: v.type,
        domain: v.domain,
        value: v.value,
        reason: v.reason,
      }))
    : [];

  const row = await insertDomain({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    domain: input.domain,
    vercelVerification: vercelVerification.length > 0 ? vercelVerification : null,
    verifiedAt: vercelRecord.verified ? new Date() : null,
    createdBy: input.createdBy,
    deletedAt: null,
  });

  logger.info({ domainId: row.id, domain: input.domain, verified: vercelRecord.verified }, "domain.added");
  return row;
}

export async function removeDomain(input: {
  workspaceId: string;
  projectId: string;
  domainId: string;
}): Promise<void> {
  const domain = await findDomainById({ workspaceId: input.workspaceId, domainId: input.domainId });
  if (!domain) throw new DomainServiceError("DOMAIN_NOT_FOUND", "domain not found");

  const project = await findProjectById(input.workspaceId, input.projectId);
  if (project?.vercelProjectId) {
    await vercel.removeDomain({
      vercelProjectId: project.vercelProjectId,
      domain: domain.domain,
      workspaceId: input.workspaceId,
    });
  }

  await softDeleteDomain({ workspaceId: input.workspaceId, domainId: input.domainId });
  logger.info({ domainId: input.domainId, domain: domain.domain }, "domain.removed");
}

/** Poll Vercel for a single domain's verification status. Returns true if newly verified. */
export async function refreshDomainVerification(input: {
  workspaceId: string;
  projectId: string;
  domainId: string;
}): Promise<{ verified: boolean }> {
  const domain = await findDomainById({ workspaceId: input.workspaceId, domainId: input.domainId });
  if (!domain) throw new DomainServiceError("DOMAIN_NOT_FOUND", "domain not found");
  if (domain.verifiedAt) return { verified: true };

  const project = await findProjectById(input.workspaceId, input.projectId);
  if (!project?.vercelProjectId) {
    throw new DomainServiceError("NO_VERCEL_PROJECT", "project has no Vercel project");
  }

  const record = await vercel.checkDomain({
    vercelProjectId: project.vercelProjectId,
    domain: domain.domain,
    workspaceId: input.workspaceId,
  });

  if (record.verified) {
    await markDomainVerified({ workspaceId: input.workspaceId, domainId: input.domainId });
    logger.info({ domainId: domain.id, domain: domain.domain }, "domain.verified");
    return { verified: true };
  }

  if (record.verification) {
    await updateDomainVerification({
      workspaceId: input.workspaceId,
      domainId: input.domainId,
      vercelVerification: record.verification.map((v) => ({
        type: v.type,
        domain: v.domain,
        value: v.value,
        reason: v.reason,
      })),
    });
  }

  return { verified: false };
}

/**
 * Batch verifier for the Inngest cron. Iterates all unverified domains
 * (platform-wide) and polls Vercel for each. Errors per-domain are logged and
 * swallowed so one bad domain doesn't abort the whole sweep.
 */
export async function reconcileUnverifiedDomains(): Promise<void> {
  const pending = await listUnverifiedDomains();
  logger.info({ count: pending.length }, "domain_reconciler.start");

  for (const domain of pending) {
    try {
      const project = await findProjectById(domain.workspaceId, domain.projectId);
      if (!project?.vercelProjectId) continue;

      const record = await vercel.checkDomain({
        vercelProjectId: project.vercelProjectId,
        domain: domain.domain,
        workspaceId: domain.workspaceId,
      });

      if (record.verified) {
        await markDomainVerified({ workspaceId: domain.workspaceId, domainId: domain.id });
        logger.info({ domainId: domain.id, domain: domain.domain }, "domain_reconciler.verified");
      }
    } catch (err) {
      logger.warn({ err, domainId: domain.id, domain: domain.domain }, "domain_reconciler.check_error");
    }
  }

  logger.info({ count: pending.length }, "domain_reconciler.done");
}
