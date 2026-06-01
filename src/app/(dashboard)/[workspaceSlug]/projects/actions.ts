"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AuthRequired,
  requireWorkspace,
  WorkspaceForbidden,
} from "@/server/auth/require-workspace";
import {
  connectRepo,
  deleteProject,
  ProjectServiceError,
} from "@/server/services/projects.service";
import {
  createDeployment,
  DeploymentServiceError,
} from "@/server/services/deployments.service";
import {
  refreshDeploymentStatus,
  RefreshDeploymentError,
} from "@/server/services/refresh-deployment.service";
import {
  provisionDatabase,
  DatabaseServiceError,
} from "@/server/services/databases.service";

export type ConnectRepoResult =
  | { ok: true; projectSlug: string }
  | { ok: false; error: string };

export type DeployResult =
  | { ok: true; deploymentId: string }
  | { ok: false; error: string };

export type DeleteProjectResult =
  | { ok: true }
  | { ok: false; error: string };

export type RefreshResult =
  | { ok: true; status: string; changed: boolean }
  | { ok: false; error: string };

export type ProvisionDatabaseResult =
  | { ok: true; databaseId: string }
  | { ok: false; error: string };

async function resolveCtx(workspaceSlug: string) {
  try {
    return await requireWorkspace({ workspaceSlug });
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    if (err instanceof WorkspaceForbidden) redirect("/workspaces");
    throw err;
  }
}

const connectSchema = z.object({
  workspaceSlug: z.string().min(1),
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().toLowerCase().min(2).max(40),
  githubRepo: z.string().trim(),
});

export async function connectRepoAction(
  _prev: ConnectRepoResult | null,
  formData: FormData,
): Promise<ConnectRepoResult> {
  const parsed = connectSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    githubRepo: formData.get("githubRepo"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }

  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  try {
    const project = await connectRepo({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      githubRepo: parsed.data.githubRepo,
    });
    revalidatePath(`/${ctx.workspaceSlug}/projects`);
    return { ok: true, projectSlug: project.slug };
  } catch (err) {
    if (err instanceof ProjectServiceError) return { ok: false, error: err.message };
    throw err;
  }
}

const deploySchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().uuid(),
  branch: z.string().min(1).optional(),
  commitSha: z.string().optional(),
});

export async function deployAction(
  _prev: DeployResult | null,
  formData: FormData,
): Promise<DeployResult> {
  const branch = (formData.get("branch") as string | null) || undefined;
  const commitSha = (formData.get("commitSha") as string | null) || undefined;
  const parsed = deploySchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    projectId: formData.get("projectId"),
    branch,
    commitSha,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }

  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  try {
    const dep = await createDeployment({
      workspaceId: ctx.workspaceId,
      projectId: parsed.data.projectId,
      userId: ctx.userId,
      branch: parsed.data.branch,
      commitSha: parsed.data.commitSha,
    });
    revalidatePath(`/${ctx.workspaceSlug}/projects`);
    return { ok: true, deploymentId: dep.id };
  } catch (err) {
    if (err instanceof DeploymentServiceError) return { ok: false, error: err.message };
    throw err;
  }
}

const deleteSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().uuid(),
  confirm: z.literal("delete"),
});

export async function deleteProjectAction(
  _prev: DeleteProjectResult | null,
  formData: FormData,
): Promise<DeleteProjectResult> {
  const parsed = deleteSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    projectId: formData.get("projectId"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "type 'delete' to confirm",
    };
  }

  const ctx = await resolveCtx(parsed.data.workspaceSlug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { ok: false, error: "only owners and admins can delete projects" };
  }

  try {
    await deleteProject({ workspaceId: ctx.workspaceId, projectId: parsed.data.projectId });
    revalidatePath(`/${ctx.workspaceSlug}/projects`);
    redirect(`/${ctx.workspaceSlug}/projects`);
  } catch (err) {
    if (err instanceof ProjectServiceError) return { ok: false, error: err.message };
    throw err;
  }
}

const refreshSchema = z.object({
  workspaceSlug: z.string().min(1),
  deploymentId: z.string().uuid(),
});

export async function refreshDeploymentAction(
  _prev: RefreshResult | null,
  formData: FormData,
): Promise<RefreshResult> {
  const parsed = refreshSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    deploymentId: formData.get("deploymentId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  try {
    const result = await refreshDeploymentStatus({
      workspaceId: ctx.workspaceId,
      deploymentId: parsed.data.deploymentId,
      actor: `user:${ctx.userId}:manual-refresh`,
    });
    revalidatePath(`/${ctx.workspaceSlug}/projects`);
    return { ok: true, status: result.status, changed: result.changed };
  } catch (err) {
    if (err instanceof RefreshDeploymentError) return { ok: false, error: err.message };
    throw err;
  }
}

const dbSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().uuid(),
  databaseName: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(63)
    .regex(/^[a-z][a-z0-9_]*$/, "lowercase letters, digits, underscores"),
  regionId: z.string().min(1).optional(),
});

export async function provisionDatabaseAction(
  _prev: ProvisionDatabaseResult | null,
  formData: FormData,
): Promise<ProvisionDatabaseResult> {
  const region = (formData.get("regionId") as string | null) || undefined;
  const parsed = dbSchema.safeParse({
    workspaceSlug: formData.get("workspaceSlug"),
    projectId: formData.get("projectId"),
    databaseName: formData.get("databaseName"),
    regionId: region,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }
  const ctx = await resolveCtx(parsed.data.workspaceSlug);

  try {
    const result = await provisionDatabase({
      workspaceId: ctx.workspaceId,
      projectId: parsed.data.projectId,
      userId: ctx.userId,
      databaseName: parsed.data.databaseName,
      regionId: parsed.data.regionId,
    });
    revalidatePath(`/${ctx.workspaceSlug}/projects`);
    return { ok: true, databaseId: result.id };
  } catch (err) {
    if (err instanceof DatabaseServiceError) return { ok: false, error: err.message };
    throw err;
  }
}
