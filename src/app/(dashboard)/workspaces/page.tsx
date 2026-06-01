import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthRequired, requireSession } from "@/server/auth/require-workspace";
import { findMembershipsForUser } from "@/server/repositories/workspaces.repo";
import { CreateWorkspaceForm } from "./create-workspace-form";

export default async function WorkspacesPage() {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    throw err;
  }

  const memberships = await findMembershipsForUser(session.user.id);

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Workspaces</h1>
        <p className="text-sm text-zinc-500">
          Signed in as {session.user.email}.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your workspaces</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No workspaces yet — create one below to get started.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {memberships.map((m) => (
              <li key={m.workspaceId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-zinc-500">
                    /{m.slug} · {m.role}
                  </div>
                </div>
                <Link
                  href={`/${m.slug}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Create a workspace</h2>
        <CreateWorkspaceForm />
      </section>
    </main>
  );
}
