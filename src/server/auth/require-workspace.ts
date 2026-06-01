import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import {
  findMembership,
  findWorkspaceBySlug,
} from "@/server/repositories/workspaces.repo";

export interface WorkspaceContext {
  userId: string;
  userEmail: string;
  workspaceId: string;
  workspaceSlug: string;
  role: "owner" | "admin" | "member";
}

export class AuthRequired extends Error {
  constructor() {
    super("AuthRequired");
    this.name = "AuthRequired";
  }
}

export class WorkspaceForbidden extends Error {
  constructor(public readonly workspaceSlug: string) {
    super("WorkspaceForbidden");
    this.name = "WorkspaceForbidden";
  }
}

/** Resolve the active session; throw AuthRequired when unauthenticated. */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new AuthRequired();
  return session;
}

/**
 * Resolve tenant context for a request. Tenant scope comes from the URL
 * (`workspaceSlug`) — explicit and trivially auditable. Membership is verified
 * before any service call. Invariant #2.
 *
 * Pass the resolved `workspaceId` into `withWorkspace(workspaceId, ...)` for
 * every tenant-scoped DB op.
 */
export async function requireWorkspace(input: {
  workspaceSlug: string;
}): Promise<WorkspaceContext> {
  const session = await requireSession();
  const workspace = await findWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) throw new WorkspaceForbidden(input.workspaceSlug);

  const membership = await findMembership(workspace.id, session.user.id);
  if (!membership) throw new WorkspaceForbidden(input.workspaceSlug);

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    role: membership.role,
  };
}

/** Server-Action / page helper: redirect rather than throw. */
export async function requireWorkspaceOrRedirect(input: { workspaceSlug: string }) {
  try {
    return await requireWorkspace(input);
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    if (err instanceof WorkspaceForbidden) redirect("/workspaces");
    throw err;
  }
}
