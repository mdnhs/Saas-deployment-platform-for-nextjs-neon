import "server-only";
import { getCredentialPlaintext } from "@/server/services/credentials.service";
import { logger } from "@/server/security/logger";

const NEON_API = "https://console.neon.tech/api/v2";

export class NeonIntegrationError extends Error {
  constructor(
    public readonly code: "NO_TOKEN" | "API_ERROR" | "FORBIDDEN" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "NeonIntegrationError";
  }
}

async function resolveToken(workspaceId: string): Promise<string> {
  try {
    const { plaintext } = await getCredentialPlaintext({
      workspaceId,
      provider: "neon",
      kind: "api_key",
    });
    return plaintext;
  } catch {
    const fallback = process.env.NEON_API_KEY;
    if (fallback) return fallback;
    throw new NeonIntegrationError(
      "NO_TOKEN",
      "no Neon credential for workspace and NEON_API_KEY env var not set — add one in workspace settings",
    );
  }
}

async function neonFetch<T>(
  workspaceId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await resolveToken(workspaceId);
  const res = await fetch(`${NEON_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new NeonIntegrationError("FORBIDDEN", `neon ${res.status} on ${path}`);
  }
  if (res.status === 404) {
    throw new NeonIntegrationError("NOT_FOUND", `neon 404 on ${path}`);
  }
  if (!res.ok) {
    const body = await res.text();
    logger.warn(
      { status: res.status, path, body: body.slice(0, 1000) },
      "neon.api_error",
    );
    throw new NeonIntegrationError(
      "API_ERROR",
      `neon ${res.status} on ${path}: ${body.slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

interface NeonProject {
  id: string;
  name: string;
  region_id: string;
  default_branch_id?: string;
}

interface NeonRole {
  branch_id: string;
  name: string;
  password?: string; // only present on creation
}

interface NeonBranch {
  id: string;
  project_id: string;
  name: string;
}

interface NeonDatabase {
  id: number;
  branch_id: string;
  name: string;
  owner_name: string;
}

interface NeonEndpoint {
  id: string;
  host: string;
  branch_id: string;
}

export interface NeonProvisionResult {
  projectId: string;
  branchId: string;
  databaseName: string;
  roleName: string;
  host: string;
  /** Returned ONCE on creation — caller MUST seal and persist immediately. */
  rolePassword: string;
}

/**
 * Spin up a fresh Neon project + database + role and return everything the
 * caller needs to assemble a DSN. The role password is returned exactly once;
 * the caller seals it into `credentials` before the response leaves this
 * function's scope.
 */
export const neon = {
  async provisionProject(input: {
    workspaceId: string;
    name: string;
    regionId?: string;
    databaseName?: string;
    roleName?: string;
  }): Promise<NeonProvisionResult> {
    const region = input.regionId ?? "aws-us-east-2";
    const dbName = input.databaseName ?? "neondb";
    const roleName = input.roleName ?? "neondb_owner";

    const created = await neonFetch<{
      project: NeonProject;
      branch: NeonBranch;
      roles: NeonRole[];
      databases: NeonDatabase[];
      endpoints: NeonEndpoint[];
    }>(input.workspaceId, "/projects", {
      method: "POST",
      body: JSON.stringify({
        project: {
          name: input.name,
          region_id: region,
          branch: {
            name: "main",
            database_name: dbName,
            role_name: roleName,
          },
        },
      }),
    });

    const role = created.roles.find((r) => r.name === roleName) ?? created.roles[0];
    if (!role?.password) {
      throw new NeonIntegrationError(
        "API_ERROR",
        "Neon response did not include a role password",
      );
    }
    const endpoint = created.endpoints[0];
    if (!endpoint?.host) {
      throw new NeonIntegrationError(
        "API_ERROR",
        "Neon response did not include an endpoint host",
      );
    }
    return {
      projectId: created.project.id,
      branchId: created.branch.id,
      databaseName: created.databases[0]?.name ?? dbName,
      roleName: role.name,
      host: endpoint.host,
      rolePassword: role.password,
    };
  },

  async getProject(workspaceId: string, neonProjectId: string) {
    return neonFetch<{ project: NeonProject }>(
      workspaceId,
      `/projects/${neonProjectId}`,
    );
  },

  async deleteProject(workspaceId: string, neonProjectId: string): Promise<void> {
    try {
      await neonFetch<unknown>(workspaceId, `/projects/${neonProjectId}`, {
        method: "DELETE",
      });
    } catch (err) {
      if (err instanceof NeonIntegrationError && err.code === "NOT_FOUND") return;
      throw err;
    }
  },
};

/**
 * Assemble a Postgres DSN from sealed parts. We never persist the assembled
 * DSN; callers should compose at the very last moment (e.g. when injecting it
 * into a Vercel env var on deploy).
 */
export function buildNeonDsn(parts: {
  host: string;
  databaseName: string;
  roleName: string;
  rolePassword: string;
  /** Defaults to `require` — Neon refuses non-TLS. */
  sslMode?: "require" | "verify-full";
}): string {
  const sslMode = parts.sslMode ?? "require";
  const password = encodeURIComponent(parts.rolePassword);
  return `postgresql://${parts.roleName}:${password}@${parts.host}/${parts.databaseName}?sslmode=${sslMode}`;
}
