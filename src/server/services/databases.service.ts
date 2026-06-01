import "server-only";
import { z } from "zod";
import { findProjectById } from "@/server/repositories/projects.repo";
import {
  attachNeonIdentifiers,
  insertDatabase,
  markDatabaseFailed,
  markDatabaseReady,
} from "@/server/repositories/databases.repo";
import { neon, NeonIntegrationError } from "@/server/integrations/neon";
import { storeCredential } from "@/server/services/credentials.service";
import { logger } from "@/server/security/logger";

export class DatabaseServiceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "PROJECT_NOT_FOUND"
      | "NEON_FAILED"
      | "NO_NEON_CREDENTIAL",
    message: string,
  ) {
    super(message);
    this.name = "DatabaseServiceError";
  }
}

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().min(1),
  databaseName: z.string().trim().min(2).max(63).regex(/^[a-z][a-z0-9_]*$/),
  regionId: z.string().min(1).optional(),
});

/**
 * Create a fresh Neon project + database for the given project. The role
 * password is sealed into `credentials` IMMEDIATELY upon return from Neon and
 * never persisted in plaintext anywhere. The application later reassembles the
 * DSN at the integration boundary via `buildNeonDsn`.
 */
export async function provisionDatabase(input: z.input<typeof inputSchema>) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new DatabaseServiceError("INVALID_INPUT", parsed.error.message);

  const project = await findProjectById(parsed.data.workspaceId, parsed.data.projectId);
  if (!project) {
    throw new DatabaseServiceError("PROJECT_NOT_FOUND", "project not found");
  }

  // Reserve the row first so concurrent attempts surface as a duplicate, and
  // so an orphaned Neon project (if the seal fails later) has a local row to
  // identify.
  const row = await insertDatabase({
    workspaceId: parsed.data.workspaceId,
    projectId: parsed.data.projectId,
    databaseName: parsed.data.databaseName,
    roleName: "neondb_owner",
    status: "provisioning",
    createdBy: parsed.data.userId,
  });

  let result;
  try {
    result = await neon.provisionProject({
      workspaceId: parsed.data.workspaceId,
      name: `${project.slug}-${parsed.data.databaseName}`,
      databaseName: parsed.data.databaseName,
      roleName: "neondb_owner",
      regionId: parsed.data.regionId,
    });
  } catch (err) {
    await markDatabaseFailed({
      workspaceId: row.workspaceId,
      databaseId: row.id,
    });
    if (err instanceof NeonIntegrationError) {
      const code = err.code === "NO_TOKEN" ? "NO_NEON_CREDENTIAL" : "NEON_FAILED";
      throw new DatabaseServiceError(code, err.message);
    }
    throw err;
  }

  try {
    // Seal the role password under the credentials table. `kind=service_account`
    // is the closest fit ("we own this account") — the metadata distinguishes
    // it from a top-level Neon API key (`kind=api_key`).
    await storeCredential({
      workspaceId: parsed.data.workspaceId,
      provider: "neon",
      kind: "service_account",
      plaintext: result.rolePassword,
      metadata: {
        kind: "role_password",
        databaseId: row.id,
        neonProjectId: result.projectId,
        roleName: result.roleName,
        databaseName: result.databaseName,
        host: result.host,
      },
      createdBy: parsed.data.userId,
    });

    await attachNeonIdentifiers({
      workspaceId: row.workspaceId,
      databaseId: row.id,
      neonProjectId: result.projectId,
      neonBranchId: result.branchId,
      host: result.host,
      roleName: result.roleName,
      databaseName: result.databaseName,
    });
    await markDatabaseReady({ workspaceId: row.workspaceId, databaseId: row.id });
  } catch (err) {
    await markDatabaseFailed({ workspaceId: row.workspaceId, databaseId: row.id });
    throw err;
  }

  logger.info(
    {
      databaseId: row.id,
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      neonProjectId: result.projectId,
    },
    "database.provisioned",
  );

  return { id: row.id, neonProjectId: result.projectId };
}
