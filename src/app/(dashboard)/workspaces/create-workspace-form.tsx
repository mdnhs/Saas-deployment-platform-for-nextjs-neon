"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createWorkspaceAction, type CreateWorkspaceResult } from "./actions";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    CreateWorkspaceResult | null,
    FormData
  >(createWorkspaceAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/${state.slug}`);
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Slug
        <input
          name="slug"
          required
          minLength={2}
          maxLength={40}
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          placeholder="acme"
          className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Creating…" : "Create workspace"}
      </button>
      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
