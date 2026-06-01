"use client";
import { useActionState } from "react";
import {
  saveNeonCredentialAction,
  saveVercelCredentialAction,
  type StoreCredentialResult,
} from "./actions";

export function CredentialForms({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <VercelForm workspaceSlug={workspaceSlug} />
      <NeonForm workspaceSlug={workspaceSlug} />
    </div>
  );
}

function VercelForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState<StoreCredentialResult | null, FormData>(
    saveVercelCredentialAction,
    null,
  );
  return (
    <form action={action} className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="space-y-1">
        <h3 className="font-medium">Vercel</h3>
        <p className="text-xs text-zinc-500">
          Personal or team access token. We attach it to outbound API calls only
          and never log it.
        </p>
      </header>
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <label className="flex flex-col gap-1 text-sm">
        Access token
        <input
          name="token"
          type="password"
          required
          minLength={20}
          maxLength={512}
          autoComplete="off"
          className="rounded-md border border-zinc-200 px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Team ID (optional)
        <input
          name="teamId"
          type="text"
          maxLength={64}
          placeholder="team_..."
          className="rounded-md border border-zinc-200 px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Save Vercel token"}
      </button>
      {state?.ok ? <p className="text-xs text-emerald-700 dark:text-emerald-300">Saved.</p> : null}
      {state && !state.ok ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

function NeonForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState<StoreCredentialResult | null, FormData>(
    saveNeonCredentialAction,
    null,
  );
  return (
    <form action={action} className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="space-y-1">
        <h3 className="font-medium">Neon</h3>
        <p className="text-xs text-zinc-500">
          Neon account API key. Used to create databases for projects in this
          workspace.
        </p>
      </header>
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <label className="flex flex-col gap-1 text-sm">
        API key
        <input
          name="token"
          type="password"
          required
          minLength={20}
          maxLength={512}
          autoComplete="off"
          className="rounded-md border border-zinc-200 px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Save Neon key"}
      </button>
      {state?.ok ? <p className="text-xs text-emerald-700 dark:text-emerald-300">Saved.</p> : null}
      {state && !state.ok ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
