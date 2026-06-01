"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { deployAction, type DeployResult } from "../actions";

export function DeployForm({
  workspaceSlug,
  projectId,
  defaultBranch,
}: {
  workspaceSlug: string;
  projectId: string;
  defaultBranch: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DeployResult | null, FormData>(
    deployAction,
    null,
  );

  return (
    <form
      action={(fd) => {
        action(fd);
        setTimeout(() => router.refresh(), 250);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="branch" value={defaultBranch} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Queueing…" : "Deploy"}
      </button>
      {state && !state.ok ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
