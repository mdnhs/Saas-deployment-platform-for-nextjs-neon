import { redirect } from "next/navigation";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { getOnboardingState } from "@/server/services/onboarding.service";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });

  const state = await getOnboardingState(ctx.workspaceId, ctx.userId);

  // Already fully set up → go straight to projects
  if (state.isComplete && state.hasProjects) {
    redirect(`/${workspaceSlug}/projects`);
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-3xl p-6 md:p-10 space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {ctx.workspaceName}
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Get started</h1>
          <p className="text-muted-foreground text-lg">
            Connect your accounts in 4 steps and deploy your first project.
          </p>
        </div>

        <OnboardingWizard
          workspaceSlug={workspaceSlug}
          initialState={state}
          userId={ctx.userId}
        />
      </main>
    </div>
  );
}
