"use server";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { setEnvVar, removeEnvVar, EnvVarError } from "@/server/services/env-vars.service";
import type { VercelEnvTarget } from "@/server/integrations/vercel";

export type EnvVarResult =
  | { ok: true }
  | { ok: false; error: string };

const VALID_TARGETS = new Set<string>(["production", "preview", "development"]);

export async function setEnvVarAction(
  _prev: EnvVarResult | null,
  formData: FormData,
): Promise<EnvVarResult> {
  const workspaceSlug = formData.get("workspaceSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const key = (formData.get("key") as string | null)?.trim().toUpperCase() ?? "";
  const value = (formData.get("value") as string | null) ?? "";
  const rawTargets = formData.getAll("target") as string[];

  if (!key || !/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    return { ok: false, error: "Key must be uppercase letters, digits, and underscores." };
  }
  if (!value) {
    return { ok: false, error: "Value is required." };
  }
  const targets = rawTargets.filter((t) => VALID_TARGETS.has(t)) as VercelEnvTarget[];
  if (targets.length === 0) {
    return { ok: false, error: "Select at least one deployment target." };
  }

  try {
    const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });
    await setEnvVar({
      workspaceId: ctx.workspaceId,
      projectSlug,
      userId: ctx.userId,
      key,
      value,
      target: targets,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof EnvVarError) return { ok: false, error: err.message };
    return { ok: false, error: "Failed to save environment variable." };
  }
}

export async function removeEnvVarAction(
  _prev: EnvVarResult | null,
  formData: FormData,
): Promise<EnvVarResult> {
  const workspaceSlug = formData.get("workspaceSlug") as string;
  const projectSlug = formData.get("projectSlug") as string;
  const envVarId = formData.get("envVarId") as string;

  try {
    const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });
    await removeEnvVar({ workspaceId: ctx.workspaceId, projectSlug, envVarId });
    return { ok: true };
  } catch (err) {
    if (err instanceof EnvVarError) return { ok: false, error: err.message };
    return { ok: false, error: "Failed to remove environment variable." };
  }
}
