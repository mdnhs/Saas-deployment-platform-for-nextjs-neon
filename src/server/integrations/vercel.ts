import "server-only";
import {
  CredentialServiceError,
  getCredentialPlaintext,
} from "@/server/services/credentials.service";
import { logger } from "@/server/security/logger";

const VERCEL_API = "https://api.vercel.com";

export class VercelIntegrationError extends Error {
  constructor(
    public readonly code: "NO_TOKEN" | "API_ERROR" | "CONFLICT" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "VercelIntegrationError";
  }
}

interface VercelCallContext {
  workspaceId?: string;
}

/**
 * Resolve a Vercel access token. Per-workspace credential wins; we fall back
 * to the platform-level `VERCEL_ACCESS_TOKEN` env var so single-tenant dev and
 * any platform-owned operations (cleanup cron, reconciler) still work.
 * Decryption happens only here, at the integration boundary (§8).
 */
async function resolveToken(ctx: VercelCallContext): Promise<{
  token: string;
  teamId?: string | undefined;
}> {
  if (ctx.workspaceId) {
    try {
      const { plaintext, metadata } = await getCredentialPlaintext({
        workspaceId: ctx.workspaceId,
        provider: "vercel",
        kind: "api_key",
      });
      const teamId =
        metadata && typeof metadata.teamId === "string" ? metadata.teamId : undefined;
      return { token: plaintext, teamId };
    } catch (err) {
      if (!(err instanceof CredentialServiceError) || err.code !== "NOT_FOUND") throw err;
      // Falls through to env fallback.
    }
  }
  const env = process.env.VERCEL_ACCESS_TOKEN;
  if (!env) {
    throw new VercelIntegrationError(
      "NO_TOKEN",
      "no Vercel credential for workspace and VERCEL_ACCESS_TOKEN env var not set",
    );
  }
  return { token: env, teamId: process.env.VERCEL_TEAM_ID || undefined };
}

async function vercelFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string; ctx?: VercelCallContext } = {},
): Promise<T> {
  const { ctx, ...fetchInit } = init;
  const { token, teamId } = await resolveToken(ctx ?? {});

  const teamQuery = teamId ? `teamId=${encodeURIComponent(teamId)}` : "";
  const sep = path.includes("?") ? "&" : "?";
  const url = teamQuery ? `${VERCEL_API}${path}${sep}${teamQuery}` : `${VERCEL_API}${path}`;

  const res = await fetch(url, {
    ...fetchInit,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(fetchInit.idempotencyKey
        ? { "x-vercel-idempotency-key": fetchInit.idempotencyKey }
        : {}),
      ...(fetchInit.headers ?? {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new VercelIntegrationError("FORBIDDEN", `vercel ${res.status} on ${path}`);
  }
  if (res.status === 409) {
    throw new VercelIntegrationError("CONFLICT", `vercel 409 on ${path}`);
  }
  if (!res.ok) {
    const body = await res.text();
    logger.warn(
      { status: res.status, path, body: body.slice(0, 1000) },
      "vercel.api_error",
    );
    throw new VercelIntegrationError(
      "API_ERROR",
      `vercel ${res.status} on ${path}: ${body.slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

interface CreateProjectInput {
  name: string;
  gitRepo: string; // "owner/repo"
  framework?: string;
  workspaceId?: string;
}

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  link?: {
    type?: "github" | "gitlab" | "bitbucket";
    repoId?: number;
    repo?: string;
    org?: string;
    productionBranch?: string;
  };
}

interface CreateDeploymentInput {
  projectId: string;
  projectName: string;
  repoId: number;
  gitBranch: string;
  commitSha?: string;
  idempotencyKey: string;
  target?: "production" | "staging";
  workspaceId?: string;
}

interface VercelDeployment {
  id: string;
  url: string;
  readyState?: string;
}

/**
 * Thin client around the Vercel REST surface area we care about for the MVP
 * loop. Each mutation accepts (or mints) an `idempotency_key` — Invariant #5.
 * Pass `workspaceId` so the per-workspace credential is used; omitting it
 * falls back to the env-level platform token.
 */
export const vercel = {
  async createProject(input: CreateProjectInput): Promise<VercelProject> {
    return vercelFetch<VercelProject>("/v9/projects", {
      method: "POST",
      ctx: { workspaceId: input.workspaceId },
      body: JSON.stringify({
        name: input.name,
        framework: input.framework ?? "nextjs",
        gitRepository: { type: "github", repo: input.gitRepo },
      }),
    });
  },

  async createDeployment(input: CreateDeploymentInput): Promise<VercelDeployment> {
    return vercelFetch<VercelDeployment>("/v13/deployments", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      ctx: { workspaceId: input.workspaceId },
      body: JSON.stringify({
        name: input.projectName,
        project: input.projectId,
        target: input.target ?? "production",
        gitSource: {
          type: "github",
          repoId: input.repoId,
          ref: input.gitBranch,
          ...(input.commitSha ? { sha: input.commitSha } : {}),
        },
      }),
    });
  },

  async getDeployment(input: {
    vercelDeploymentId: string;
    workspaceId?: string;
  }): Promise<VercelDeployment> {
    return vercelFetch<VercelDeployment>(`/v13/deployments/${input.vercelDeploymentId}`, {
      ctx: { workspaceId: input.workspaceId },
    });
  },

  async getProject(input: {
    vercelProjectId: string;
    workspaceId?: string;
  }): Promise<VercelProject> {
    return vercelFetch<VercelProject>(`/v9/projects/${input.vercelProjectId}`, {
      ctx: { workspaceId: input.workspaceId },
    });
  },

  /**
   * Delete a Vercel project. 404 is treated as success — the project is already
   * gone (e.g. deleted by hand in the dashboard).
   */
  async deleteProject(input: {
    vercelProjectId: string;
    workspaceId?: string;
  }): Promise<void> {
    try {
      await vercelFetch<unknown>(`/v9/projects/${input.vercelProjectId}`, {
        method: "DELETE",
        ctx: { workspaceId: input.workspaceId },
      });
    } catch (err) {
      if (
        err instanceof VercelIntegrationError &&
        err.code === "API_ERROR" &&
        /404/.test(err.message)
      ) {
        return;
      }
      throw err;
    }
  },

  /**
   * Add a custom domain to a Vercel project. Returns the domain record including
   * any verification records the user must configure in their DNS registrar.
   * 409 → domain already added (treat as success, re-fetch to get verification).
   */
  async addDomain(input: {
    vercelProjectId: string;
    domain: string;
    workspaceId?: string;
  }): Promise<VercelDomainRecord> {
    try {
      return await vercelFetch<VercelDomainRecord>(
        `/v9/projects/${input.vercelProjectId}/domains`,
        {
          method: "POST",
          ctx: { workspaceId: input.workspaceId },
          body: JSON.stringify({ name: input.domain }),
        },
      );
    } catch (err) {
      if (err instanceof VercelIntegrationError && err.code === "CONFLICT") {
        return vercelFetch<VercelDomainRecord>(
          `/v9/projects/${input.vercelProjectId}/domains/${encodeURIComponent(input.domain)}`,
          { ctx: { workspaceId: input.workspaceId } },
        );
      }
      throw err;
    }
  },

  /**
   * Remove a domain from a Vercel project. 404 → already removed; treat as success.
   */
  async removeDomain(input: {
    vercelProjectId: string;
    domain: string;
    workspaceId?: string;
  }): Promise<void> {
    try {
      await vercelFetch<unknown>(
        `/v9/projects/${input.vercelProjectId}/domains/${encodeURIComponent(input.domain)}`,
        {
          method: "DELETE",
          ctx: { workspaceId: input.workspaceId },
        },
      );
    } catch (err) {
      if (
        err instanceof VercelIntegrationError &&
        err.code === "API_ERROR" &&
        /404/.test(err.message)
      ) {
        return;
      }
      throw err;
    }
  },

  /** Poll current verification status of a domain on a project. */
  async checkDomain(input: {
    vercelProjectId: string;
    domain: string;
    workspaceId?: string;
  }): Promise<VercelDomainRecord> {
    return vercelFetch<VercelDomainRecord>(
      `/v9/projects/${input.vercelProjectId}/domains/${encodeURIComponent(input.domain)}`,
      { ctx: { workspaceId: input.workspaceId } },
    );
  },

  /**
   * Create or update an env var on a Vercel project.
   * - Pass `vercelEnvId` to PATCH an existing var (value/target update).
   * - Omit it to POST a new var; the returned ID should be persisted.
   */
  async upsertEnvVar(input: {
    vercelProjectId: string;
    workspaceId?: string;
    vercelEnvId?: string;
    key: string;
    value: string;
    target: VercelEnvTarget[];
  }): Promise<VercelEnvVar> {
    if (input.vercelEnvId) {
      return vercelFetch<VercelEnvVar>(
        `/v9/projects/${input.vercelProjectId}/env/${input.vercelEnvId}`,
        {
          method: "PATCH",
          ctx: { workspaceId: input.workspaceId },
          body: JSON.stringify({ value: input.value, type: "encrypted", target: input.target }),
        },
      );
    }
    const res = await vercelFetch<VercelCreateEnvResponse>(
      `/v9/projects/${input.vercelProjectId}/env`,
      {
        method: "POST",
        ctx: { workspaceId: input.workspaceId },
        body: JSON.stringify([
          { key: input.key, value: input.value, type: "encrypted", target: input.target },
        ]),
      },
    );
    const created = res.created[0];
    if (!created) {
      const failed = res.failed[0];
      throw new VercelIntegrationError(
        "API_ERROR",
        `vercel env create failed: ${failed?.error?.message ?? "unknown"}`,
      );
    }
    return created;
  },

  /** Delete an env var from a Vercel project. 404 = already gone, treated as no-op. */
  async deleteEnvVar(input: {
    vercelProjectId: string;
    vercelEnvId: string;
    workspaceId?: string;
  }): Promise<void> {
    try {
      await vercelFetch<unknown>(
        `/v9/projects/${input.vercelProjectId}/env/${input.vercelEnvId}`,
        { method: "DELETE", ctx: { workspaceId: input.workspaceId } },
      );
    } catch (err) {
      if (err instanceof VercelIntegrationError && err.code === "API_ERROR") return;
      throw err;
    }
  },
};

export interface VercelDomainRecord {
  name: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

export type VercelEnvTarget = "production" | "preview" | "development";

export interface VercelEnvVar {
  id: string;
  key: string;
  type: "plain" | "secret" | "encrypted" | "system";
  target: VercelEnvTarget[];
}

interface VercelCreateEnvResponse {
  created: VercelEnvVar[];
  failed: Array<{ key: string; error: { code: string; message: string } }>;
}
