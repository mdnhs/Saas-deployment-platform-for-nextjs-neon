"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  connectRepoAction,
  type ConnectRepoResult,
} from "../actions";
import type { GithubRepoSummary } from "@/server/integrations/github";

export function ConnectRepoForm({
  workspaceSlug,
  repos,
}: {
  workspaceSlug: string;
  repos: GithubRepoSummary[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ConnectRepoResult | null, FormData>(
    connectRepoAction,
    null,
  );
  const [selected, setSelected] = useState<string>(repos[0]?.fullName ?? "");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (state?.ok) router.push(`/${workspaceSlug}/projects/${state.projectSlug}`);
  }, [state, router, workspaceSlug]);

  // Auto-derive name + slug from selected repo (user can override).
  useEffect(() => {
    if (!selected) return;
    const repoName = selected.split("/")[1] ?? "";
    if (!name) setName(repoName);
    if (!slug) setSlug(repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    // intentionally only react to `selected`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />

      <label className="flex flex-col gap-1 text-sm">
        Repository
        <select
          name="githubRepo"
          required
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {repos.length === 0 ? (
            <option value="" disabled>
              (no repos found)
            </option>
          ) : (
            repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
                {r.private ? " · private" : ""}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Project name
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !selected}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Connecting…" : "Connect repo"}
      </button>
      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
