import Link from "next/link";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import {
  GithubIntegrationError,
  listUserRepos,
} from "@/server/integrations/github";
import { ConnectRepoForm } from "./connect-form";
import { IconArrowLeft, IconAlertTriangle, IconBrandGithub } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });

  let repos: Awaited<ReturnType<typeof listUserRepos>> = [];
  let listError: string | null = null;
  try {
    repos = await listUserRepos(ctx.userId);
  } catch (err) {
    if (err instanceof GithubIntegrationError) {
      listError =
        err.code === "NO_TOKEN"
          ? "Sign in with GitHub to list your repos."
          : `GitHub error: ${err.message}`;
    } else {
      throw err;
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-2xl space-y-8 p-6 md:p-10">
        {/* Back link */}
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={`/${workspaceSlug}/projects`}>
            <IconArrowLeft className="size-4 mr-1.5" />
            Projects
          </Link>
        </Button>

        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <IconBrandGithub className="size-3.5" />
            Connect repository
          </div>
          <h1 className="text-3xl font-bold tracking-tight">New project</h1>
          <p className="text-muted-foreground">
            Pick a GitHub repo and we&apos;ll create a matching Vercel project. First deployment is one click away.
          </p>
        </div>

        {/* GitHub error */}
        {listError && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <IconAlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
            <div className="space-y-1">
              <p className="font-medium text-destructive">GitHub not connected</p>
              <p className="text-muted-foreground">{listError}</p>
              {listError.includes("Sign in") && (
                <a
                  href="/api/auth/sign-in/social?provider=github"
                  className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2 text-xs mt-1"
                >
                  <IconBrandGithub className="size-3.5" />
                  Connect GitHub account
                </a>
              )}
            </div>
          </div>
        )}

        <ConnectRepoForm workspaceSlug={workspaceSlug} repos={repos} />
      </main>
    </div>
  );
}
