import Link from "next/link";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import {
  GithubIntegrationError,
  listUserRepos,
} from "@/server/integrations/github";
import { ConnectRepoForm } from "./connect-form";

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
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <header className="space-y-1">
        <Link
          href={`/${workspaceSlug}/projects`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Projects
        </Link>
        <h1 className="text-2xl font-semibold">Connect a repo</h1>
        <p className="text-sm text-zinc-500">
          Pick a GitHub repo and we'll create a matching Vercel project. The
          first deployment is one click away.
        </p>
      </header>

      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {listError}
        </p>
      ) : null}

      <ConnectRepoForm workspaceSlug={workspaceSlug} repos={repos} />
    </main>
  );
}
