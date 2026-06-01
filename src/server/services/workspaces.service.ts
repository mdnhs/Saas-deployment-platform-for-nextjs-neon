import "server-only";
import { z } from "zod";
import {
  findWorkspaceBySlug,
  insertWorkspaceWithOwner,
} from "@/server/repositories/workspaces.repo";
import { logger } from "@/server/security/logger";

export class WorkspaceServiceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "SLUG_TAKEN",
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

const nameSchema = z.string().trim().min(2).max(60);
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "lowercase letters, digits, hyphens");

export async function createWorkspace(input: {
  name: string;
  slug: string;
  ownerId: string;
}) {
  const parsed = z
    .object({ name: nameSchema, slug: slugSchema, ownerId: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) {
    throw new WorkspaceServiceError("INVALID_INPUT", parsed.error.message);
  }

  const existing = await findWorkspaceBySlug(parsed.data.slug);
  if (existing) {
    throw new WorkspaceServiceError("SLUG_TAKEN", `slug "${parsed.data.slug}" is taken`);
  }

  const workspace = await insertWorkspaceWithOwner(parsed.data);
  logger.info(
    { workspaceId: workspace.id, slug: workspace.slug, ownerId: parsed.data.ownerId },
    "workspace.created",
  );
  return workspace;
}
