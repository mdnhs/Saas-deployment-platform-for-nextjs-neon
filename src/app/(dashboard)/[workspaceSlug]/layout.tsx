import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { Navbar } from "./navbar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar 
        workspaceSlug={workspaceSlug}
        workspaceName={ctx.workspaceName}
        role={ctx.role}
        userEmail={ctx.userEmail}
      />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
