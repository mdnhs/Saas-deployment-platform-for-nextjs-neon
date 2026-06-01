"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { refreshDeploymentAction, type RefreshResult } from "../actions";

export function RefreshDeploymentButton({
  workspaceSlug,
  deploymentId,
}: {
  workspaceSlug: string;
  deploymentId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<RefreshResult | null, FormData>(
    refreshDeploymentAction,
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
      <input type="hidden" name="deploymentId" value={deploymentId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        title="Poll Vercel for latest status (use when webhooks aren't set up)"
      >
        {pending ? "…" : "refresh"}
      </button>
      {state && !state.ok ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
