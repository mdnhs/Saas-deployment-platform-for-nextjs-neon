import Link from "next/link";
import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";

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
    <div className="min-h-screen">
      <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 text-sm dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <Link href="/workspaces" className="font-semibold">
            ← Workspaces
          </Link>
          <span className="text-zinc-500">/</span>
          <span className="font-medium">{ctx.workspaceSlug}</span>
          <span className="text-xs uppercase text-zinc-500">{ctx.role}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/${workspaceSlug}/projects`} className="text-zinc-600 hover:underline dark:text-zinc-300">
            Projects
          </Link>
          <Link href={`/${workspaceSlug}/members`} className="text-zinc-600 hover:underline dark:text-zinc-300">
            Members
          </Link>
          <Link href={`/${workspaceSlug}/settings`} className="text-zinc-600 hover:underline dark:text-zinc-300">
            Settings
          </Link>
          <span className="text-xs text-zinc-500">{ctx.userEmail}</span>
        </div>
      </nav>
      {children}
    </div>
  );
}
