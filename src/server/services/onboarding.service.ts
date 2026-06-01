import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { account } from "@/server/db/schema";
import { listCredentialsForWorkspace } from "@/server/repositories/credentials.repo";
import { countActiveProjects } from "@/server/repositories/projects.repo";

export interface OnboardingState {
  githubConnected: boolean;
  vercelConnected: boolean;
  neonConnected: boolean;
  hasProjects: boolean;
  /** First incomplete step (1–4). 4 = all done except launch. */
  activeStep: 1 | 2 | 3 | 4;
  isComplete: boolean;
}

export async function getOnboardingState(
  workspaceId: string,
  userId: string,
): Promise<OnboardingState> {
  const [githubRows, credentials, projectCount] = await Promise.all([
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
      .limit(1),
    listCredentialsForWorkspace(workspaceId),
    countActiveProjects(workspaceId),
  ]);

  const githubConnected = githubRows.length > 0;
  const vercelConnected = credentials.some((c) => c.provider === "vercel");
  const neonConnected = credentials.some((c) => c.provider === "neon");
  const hasProjects = projectCount > 0;

  const activeStep: 1 | 2 | 3 | 4 = !githubConnected
    ? 1
    : !vercelConnected
      ? 2
      : !neonConnected
        ? 3
        : 4;

  const isComplete = githubConnected && vercelConnected && hasProjects;

  return { githubConnected, vercelConnected, neonConnected, hasProjects, activeStep, isComplete };
}
