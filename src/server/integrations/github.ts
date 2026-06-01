import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { account } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

const GITHUB_API = "https://api.github.com";

export interface GithubRepoSummary {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  updatedAt: string;
}

export class GithubIntegrationError extends Error {
  constructor(
    public readonly code: "NO_TOKEN" | "API_ERROR" | "FORBIDDEN" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "GithubIntegrationError";
  }
}

/**
 * Pull the GitHub OAuth access token Better Auth stored on the most recent
 * `account` row for this user. We DO NOT cache this in app memory — every
 * integration call reads fresh in case the token was rotated/revoked.
 *
 * NOTE: this is a Phase-2 shortcut. In Phase 4 the credential moves into the
 * `credentials` table under envelope encryption, and this function becomes a
 * call into `credential.service`.
 */
async function getUserGithubToken(userId: string): Promise<string> {
  const rows = await db
    .select({ token: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .orderBy(desc(account.updatedAt))
    .limit(1);

  const token = rows[0]?.token;
  if (!token) {
    throw new GithubIntegrationError(
      "NO_TOKEN",
      "no GitHub OAuth token for user — sign in with GitHub first",
    );
  }
  return token;
}

async function githubFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new GithubIntegrationError("FORBIDDEN", `github ${res.status} on ${path}`);
  }
  if (res.status === 404) {
    throw new GithubIntegrationError("NOT_FOUND", `github 404 on ${path}`);
  }
  if (!res.ok) {
    const body = await res.text();
    logger.warn({ status: res.status, path, bodyPreview: body.slice(0, 200) }, "github.api_error");
    throw new GithubIntegrationError("API_ERROR", `github ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * List repos the user can administer. We need `admin` (or at least `push`) to
 * configure Vercel against the repo. We sort by recent push so the list is
 * useful.
 */
export async function listUserRepos(userId: string): Promise<GithubRepoSummary[]> {
  const token = await getUserGithubToken(userId);
  type GithubRepo = {
    full_name: string;
    default_branch: string;
    private: boolean;
    description: string | null;
    updated_at: string;
    permissions?: { admin?: boolean; push?: boolean };
  };
  const data = await githubFetch<GithubRepo[]>(
    token,
    "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member",
  );
  return data
    .filter((r) => r.permissions?.admin || r.permissions?.push)
    .map((r) => ({
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      private: r.private,
      description: r.description,
      updatedAt: r.updated_at,
    }));
}

/** Fetch a specific repo's metadata. Used to verify the user can reach it. */
export async function getRepo(userId: string, fullName: string) {
  const token = await getUserGithubToken(userId);
  type Repo = { full_name: string; default_branch: string; private: boolean };
  return githubFetch<Repo>(token, `/repos/${fullName}`);
}
