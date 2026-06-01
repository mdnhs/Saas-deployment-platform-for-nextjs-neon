import "server-only";
import { z } from "zod";
import {
  attachVercelProjectId,
  countActiveProjects,
  findProjectBySlug,
  findProjectById,
  insertProject,
  softDeleteProject,
} from "@/server/repositories/projects.repo";
import { assertCountLimit, BillingError } from "@/server/services/billing.service";
import { vercel, VercelIntegrationError } from "@/server/integrations/vercel";
import { getRepo, GithubIntegrationError } from "@/server/integrations/github";
import { logger } from "@/server/security/logger";

export class ProjectServiceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "SLUG_TAKEN"
      | "GITHUB_FORBIDDEN"
      | "VERCEL_FAILED"
      | "VERCEL_CONFLICT"
      | "NOT_FOUND"
      | "PLAN_LIMIT_EXCEEDED",
    message: string,
  ) {
    super(message);
    this.name = "ProjectServiceError";
  }
}

const nameSchema = z.string().trim().min(2).max(60);
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
const repoSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/, "must be owner/repo");

const connectInput = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().min(1),
  name: nameSchema,
  slug: slugSchema,
  githubRepo: repoSchema,
});

/**
 * Connect a GitHub repo as a Vercel-backed project. This is the *only* place
 * that orchestrates GitHub + Vercel as a unit; ordering matters:
 *
 *   1. Validate input.
 *   2. Verify the user can read the repo on GitHub (catches typos + perms
 *      before we burn a paid Vercel project).
 *   3. Reserve the workspace slug (uniqueness is a DB constraint; we check
 *      first to give a nicer error).
 *   4. Create the Vercel project. If this fails partway, we have NO local row
 *      yet — operator retries with the same slug.
 *   5. Persist the project row + the returned Vercel project id.
 *
 * Soft delete + Phase-3 cleanup will tear down the external resource on
 * project delete. Invariant #8.
 */
export async function connectRepo(input: z.input<typeof connectInput>) {
  const parsed = connectInput.safeParse(input);
  if (!parsed.success) throw new ProjectServiceError("INVALID_INPUT", parsed.error.message);
  const data = parsed.data;

  try {
    await getRepo(data.userId, data.githubRepo);
  } catch (err) {
    if (err instanceof GithubIntegrationError) {
      throw new ProjectServiceError("GITHUB_FORBIDDEN", err.message);
    }
    throw err;
  }

  const currentCount = await countActiveProjects(data.workspaceId);
  try {
    await assertCountLimit({ workspaceId: data.workspaceId, metric: "projects", currentCount });
  } catch (err) {
    if (err instanceof BillingError) throw new ProjectServiceError("PLAN_LIMIT_EXCEEDED", err.message);
    throw err;
  }

  const existing = await findProjectBySlug(data.workspaceId, data.slug);
  if (existing) throw new ProjectServiceError("SLUG_TAKEN", `slug "${data.slug}" is taken`);

  const repoMeta = await getRepo(data.userId, data.githubRepo);

  let vercelProject;
  try {
    vercelProject = await vercel.createProject({
      name: `${data.slug}-${data.workspaceId.slice(0, 8)}`,
      gitRepo: data.githubRepo,
      workspaceId: data.workspaceId,
    });
  } catch (err) {
    if (err instanceof VercelIntegrationError) {
      const code = err.code === "CONFLICT" ? "VERCEL_CONFLICT" : "VERCEL_FAILED";
      throw new ProjectServiceError(code, err.message);
    }
    throw err;
  }

  const row = await insertProject({
    workspaceId: data.workspaceId,
    name: data.name,
    slug: data.slug,
    githubRepo: data.githubRepo,
    githubDefaultBranch: repoMeta.default_branch ?? "main",
    vercelProjectId: vercelProject.id,
    createdBy: data.userId,
  });

  // `insertProject` already wrote the id, but call this defensively so the
  // attach path exists in one place if we ever split creation and connection.
  await attachVercelProjectId({
    workspaceId: data.workspaceId,
    projectId: row.id,
    vercelProjectId: vercelProject.id,
  });

  logger.info(
    { projectId: row.id, slug: row.slug, workspaceId: row.workspaceId, vercelProjectId: vercelProject.id },
    "project.connected",
  );
  return row;
}

/**
 * Soft delete only — the cleanup cron tears down the Vercel project + hard
 * deletes after the grace period. Returning the user immediately is safe
 * because the external resource still exists (so it doesn't go silently
 * missing if the user changes their mind during the grace window).
 */
export async function deleteProject(input: { workspaceId: string; projectId: string }) {
  const project = await findProjectById(input.workspaceId, input.projectId);
  if (!project) throw new ProjectServiceError("NOT_FOUND", "project not found");
  if (project.deletedAt) return project; // already soft-deleted; idempotent

  const row = await softDeleteProject(input.workspaceId, input.projectId);
  if (!row) throw new ProjectServiceError("NOT_FOUND", "project not found");
  logger.info(
    { projectId: row.id, workspaceId: row.workspaceId },
    "project.soft_deleted",
  );
  return row;
}
