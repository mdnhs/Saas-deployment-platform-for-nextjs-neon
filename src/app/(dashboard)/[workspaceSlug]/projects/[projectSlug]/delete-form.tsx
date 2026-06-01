"use client";
import { useActionState, useState } from "react";
import { deleteProjectAction, type DeleteProjectResult } from "../actions";

export function DeleteProjectForm({
  workspaceSlug,
  projectId,
  projectName,
}: {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteProjectResult | null, FormData>(
    deleteProjectAction,
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
      >
        Delete project
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950">
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="projectId" value={projectId} />
      <span>
        Type <code className="font-mono">delete</code> to remove <strong>{projectName}</strong>:
      </span>
      <input
        name="confirm"
        autoFocus
        required
        pattern="delete"
        className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-red-600 px-3 py-1 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-zinc-600 hover:underline dark:text-zinc-300"
      >
        Cancel
      </button>
      {state && !state.ok ? <span className="text-red-700 dark:text-red-300">{state.error}</span> : null}
    </form>
  );
}
