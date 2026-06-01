import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { listCredentialsForWorkspace } from "@/server/repositories/credentials.repo";
import { CredentialForms } from "./credential-forms";
import { CredentialList } from "./credential-list";
import { 
  IconSettings, 
  IconShieldLock, 
  IconKey, 
  IconInfoCircle,
  IconLock
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from "@/components/ui/alert";

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
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-6xl space-y-10 p-6 md:p-10">
        <header className="relative overflow-hidden rounded-2xl bg-zinc-900 px-8 py-12 text-white dark:bg-zinc-950">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <IconSettings className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{ctx.workspaceName}</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
              <p className="text-zinc-400">
                Manage workspace configuration and integration credentials.
              </p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800/50 py-1 text-zinc-300">
                <IconShieldLock className="size-3 mr-1" />
                Encrypted
              </Badge>
            </div>
          </div>
          {/* Subtle background decoration */}
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-indigo-600/20 blur-3xl" />
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            <Alert className="bg-primary/5 border-primary/20">
              <IconInfoCircle className="size-4 text-primary" />
              <AlertTitle className="text-primary font-semibold">Security Note</AlertTitle>
              <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
                Third-party credentials are envelope-encrypted with the platform&apos;s master
                key. We display only metadata here; the plaintext token never leaves the
                server&apos;s integration boundary.
              </AlertDescription>
            </Alert>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Configured Credentials</h2>
                <Badge variant="secondary">{credentials.length} Active</Badge>
              </div>
              <CredentialList
                workspaceSlug={workspaceSlug}
                credentials={credentials}
                readOnly={readOnly}
              />
            </section>

            {!readOnly ? (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight">Add or Rotate</h2>
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <IconKey className="size-5" />
                  </div>
                </div>
                <CredentialForms workspaceSlug={workspaceSlug} />
              </section>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20">
                <IconLock className="size-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Only owners and admins can manage credentials.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-6 text-sm">
            <div className="sticky top-6 space-y-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Workspace Metadata</h3>
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <code className="text-[10px] font-mono">{ctx.workspaceId.slice(0, 8)}...</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <Badge variant="outline" className="text-[10px]">Free</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Compliance</h3>
                <div className="rounded-xl border bg-card p-4 space-y-4 text-muted-foreground leading-relaxed text-xs">
                  <p>
                    All API keys are stored in a secure vault. Access is strictly audited.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
