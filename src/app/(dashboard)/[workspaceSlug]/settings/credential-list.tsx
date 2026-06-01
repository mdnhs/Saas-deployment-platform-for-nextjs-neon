"use client";
import { useActionState } from "react";
import { deleteCredentialAction, type StoreCredentialResult } from "./actions";

interface CredentialRow {
  id: string;
  provider: string;
  kind: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  rotatedAt: Date | null;
}

export function CredentialList({
  workspaceSlug,
  credentials,
  readOnly,
}: {
  workspaceSlug: string;
  credentials: CredentialRow[];
  readOnly: boolean;
}) {
  if (credentials.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No credentials configured yet. Add a Vercel token (and optionally a Neon
        API key) below.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {credentials.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-0.5">
            <div className="font-medium capitalize">
              {c.provider} <span className="text-xs uppercase text-zinc-500">{c.kind}</span>
            </div>
            <div className="text-xs text-zinc-500">
              created {new Date(c.createdAt).toLocaleString()}
              {c.rotatedAt
                ? ` · rotated ${new Date(c.rotatedAt).toLocaleString()}`
                : ""}
            </div>
            {c.metadata ? <MetadataLine metadata={c.metadata} /> : null}
          </div>
          {!readOnly ? <DeleteButton workspaceSlug={workspaceSlug} credentialId={c.id} /> : null}
        </li>
      ))}
    </ul>
  );
}

function MetadataLine({ metadata }: { metadata: Record<string, unknown> }) {
  const pairs = Object.entries(metadata)
    .filter(([, v]) => typeof v === "string" || typeof v === "number")
    .slice(0, 4);
  if (pairs.length === 0) return null;
  return (
    <div className="text-xs text-zinc-500">
      {pairs.map(([k, v]) => (
        <span key={k} className="mr-3 font-mono">
          {k}={String(v)}
        </span>
      ))}
    </div>
  );
}

function DeleteButton({
  workspaceSlug,
  credentialId,
}: {
  workspaceSlug: string;
  credentialId: string;
}) {
  const [state, action, pending] = useActionState<StoreCredentialResult | null, FormData>(
    deleteCredentialAction,
    null,
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="credentialId" value={credentialId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
      >
        {pending ? "…" : "remove"}
      </button>
      {state && !state.ok ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
