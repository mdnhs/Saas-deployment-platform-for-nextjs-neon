import "server-only";
import { seal, open, currentKeyVersion } from "@/server/security/crypto";
import { vercel } from "@/server/integrations/vercel";
import type { VercelEnvTarget } from "@/server/integrations/vercel";
import {
  listEnvVarsForProject,
  findEnvVarById,
  findActiveEnvVar,
  insertEnvVar,
  setVercelEnvId,
  softDeleteEnvVar,
} from "@/server/repositories/env-vars.repo";
import { findProjectBySlug } from "@/server/repositories/projects.repo";
import type { ProjectEnvVar } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

export class EnvVarError extends Error {
  constructor(
    public readonly code:
      | "PROJECT_NOT_FOUND"
      | "NO_VERCEL_PROJECT"
      | "ENV_VAR_NOT_FOUND"
      | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "EnvVarError";
  }
}

/** Returned to the UI — never includes ciphertext or auth material. */
export interface EnvVarRow {
  id: string;
  key: string;
  target: string[];
  createdAt: Date;
  updatedAt: Date;
}

function toRow(v: ProjectEnvVar): EnvVarRow {
  return {
    id: v.id,
    key: v.key,
    target: v.target as string[],
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function aad(workspaceId: string, projectId: string, key: string) {
  return `${workspaceId}:${projectId}:${key}`;
}

export async function listEnvVars(
  workspaceId: string,
  projectId: string,
): Promise<EnvVarRow[]> {
  const rows = await listEnvVarsForProject(workspaceId, projectId);
  return rows.map(toRow);
}

export async function setEnvVar(input: {
  workspaceId: string;
  projectSlug: string;
  userId: string;
  key: string;
  value: string;
  target: VercelEnvTarget[];
}): Promise<EnvVarRow> {
  const project = await findProjectBySlug(input.workspaceId, input.projectSlug);
  if (!project) throw new EnvVarError("PROJECT_NOT_FOUND", "project not found");
  if (!project.vercelProjectId) {
    throw new EnvVarError("NO_VERCEL_PROJECT", "project not yet linked to Vercel");
  }

  // Find existing to inherit vercelEnvId if present
  const existing = await findActiveEnvVar(input.workspaceId, project.id, input.key);

  // Seal value — AAD ties ciphertext to this exact (workspace, project, key)
  const sealed = seal(input.value, aad(input.workspaceId, project.id, input.key));

  // Upsert to Vercel — PATCH if we have an ID, POST otherwise
  const vercelEnvVar = await vercel.upsertEnvVar({
    vercelProjectId: project.vercelProjectId,
    workspaceId: input.workspaceId,
    vercelEnvId: existing?.vercelEnvId ?? undefined,
    key: input.key,
    value: input.value,
    target: input.target,
  });

  // Soft-delete the old row so the unique index allows the new insert
  if (existing) {
    await softDeleteEnvVar(input.workspaceId, existing.id);
  }

  // Insert fresh row with the Vercel env var ID
  const row = await insertEnvVar({
    workspaceId: input.workspaceId,
    projectId: project.id,
    key: input.key,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    authTag: sealed.authTag,
    keyVersion: currentKeyVersion(),
    vercelEnvId: vercelEnvVar.id,
    target: input.target,
    createdBy: input.userId,
  });

  logger.info(
    { workspaceId: input.workspaceId, projectId: project.id, key: input.key },
    "env_var.set",
  );
  return toRow(row);
}

export async function removeEnvVar(input: {
  workspaceId: string;
  projectSlug: string;
  envVarId: string;
}): Promise<void> {
  const project = await findProjectBySlug(input.workspaceId, input.projectSlug);
  if (!project) throw new EnvVarError("PROJECT_NOT_FOUND", "project not found");

  const row = await findEnvVarById(input.workspaceId, input.envVarId);
  if (!row) throw new EnvVarError("ENV_VAR_NOT_FOUND", "env var not found");

  // Remove from Vercel first (404 = already gone)
  if (project.vercelProjectId && row.vercelEnvId) {
    await vercel.deleteEnvVar({
      vercelProjectId: project.vercelProjectId,
      vercelEnvId: row.vercelEnvId,
      workspaceId: input.workspaceId,
    });
  }

  await softDeleteEnvVar(input.workspaceId, row.id);

  logger.info(
    { workspaceId: input.workspaceId, projectId: project.id, key: row.key },
    "env_var.removed",
  );
}

/** Decrypt a single var — called only at the integration boundary (e.g. inject into deployment). */
export function decryptEnvVar(row: ProjectEnvVar, workspaceId: string, projectId: string): string {
  return open(
    {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.authTag,
      keyVersion: row.keyVersion,
    },
    aad(workspaceId, projectId, row.key),
  );
}
