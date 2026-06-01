import { redirect } from "next/navigation";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { getOnboardingState } from "@/server/services/onboarding.service";

export const dynamic = "force-dynamic";

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });
  const state = await getOnboardingState(ctx.workspaceId, ctx.userId);

  if (!state.isComplete) {
    redirect(`/${workspaceSlug}/onboarding`);
  }

  redirect(`/${workspaceSlug}/projects`);
}
