import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { listCredentialsForWorkspace } from "@/server/repositories/credentials.repo";
import { CredentialForms } from "./credential-forms";
import { CredentialList } from "./credential-list";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });
  const credentials = await listCredentialsForWorkspace(ctx.workspaceId);

  const readOnly = ctx.role !== "owner" && ctx.role !== "admin";

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Workspace settings</h1>
        <p className="text-sm text-zinc-500">
          Third-party credentials are envelope-encrypted with the platform's master
          key. We display only metadata here; the plaintext token never leaves the
          server's integration boundary.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Configured credentials</h2>
        <CredentialList
          workspaceSlug={workspaceSlug}
          credentials={credentials}
          readOnly={readOnly}
        />
      </section>

      {!readOnly ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Add or rotate</h2>
          <CredentialForms workspaceSlug={workspaceSlug} />
        </section>
      ) : (
        <p className="text-xs text-zinc-500">
          Only owners and admins can manage credentials.
        </p>
      )}
    </main>
  );
}
