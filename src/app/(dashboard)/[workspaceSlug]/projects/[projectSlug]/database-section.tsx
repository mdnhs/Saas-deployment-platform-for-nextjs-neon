"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { provisionDatabaseAction, type ProvisionDatabaseResult } from "../actions";

interface DatabaseSummary {
  id: string;
  databaseName: string;
  roleName: string;
  host: string | null;
  status: "provisioning" | "ready" | "failed" | "archived";
  neonProjectId: string | null;
  createdAt: Date;
}

export function DatabaseSection({
  workspaceSlug,
  projectId,
  databases,
  canManage,
}: {
  workspaceSlug: string;
  projectId: string;
  databases: DatabaseSummary[];
  canManage: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Databases</h2>
      {databases.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No databases yet. Provision one to attach a Neon Postgres to this project.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {databases.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-0.5">
                <div className="font-medium">
                  {d.databaseName}{" "}
                  <span className="text-xs uppercase text-zinc-500">{d.status}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {d.host ?? "(host pending)"} · role <code>{d.roleName}</code>
                  {d.neonProjectId ? (
                    <>
                      {" "}
                      · neon <code>{d.neonProjectId}</code>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <ProvisionForm workspaceSlug={workspaceSlug} projectId={projectId} />
      ) : null}
    </section>
  );
}

function ProvisionForm({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ProvisionDatabaseResult | null, FormData>(
    provisionDatabaseAction,
    null,
  );

  return (
    <form
      action={(fd) => {
        action(fd);
        setTimeout(() => router.refresh(), 250);
      }}
      className="flex items-end gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
    >
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="projectId" value={projectId} />
      <label className="flex flex-1 flex-col gap-1">
        Database name
        <input
          name="databaseName"
          required
          pattern="[a-z][a-z0-9_]*"
          minLength={2}
          maxLength={63}
          defaultValue="appdb"
          className="rounded-md border border-zinc-200 px-3 py-1.5 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1">
        Region
        <select
          name="regionId"
          defaultValue="aws-us-east-2"
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
        >
          <option value="aws-us-east-2">aws-us-east-2</option>
          <option value="aws-us-east-1">aws-us-east-1</option>
          <option value="aws-us-west-2">aws-us-west-2</option>
          <option value="aws-eu-central-1">aws-eu-central-1</option>
          <option value="aws-ap-southeast-1">aws-ap-southeast-1</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Provisioning…" : "Provision database"}
      </button>
      {state && !state.ok ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
