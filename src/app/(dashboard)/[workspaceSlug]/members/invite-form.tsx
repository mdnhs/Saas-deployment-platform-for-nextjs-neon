"use client";
import { useActionState } from "react";
import { inviteMemberAction, type InviteResult } from "./actions";

export function InviteMemberForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(
    inviteMemberAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Role
        <select
          name="role"
          defaultValue="member"
          className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>
      {state?.ok ? (
        <p className="text-sm text-green-600">Invite created for {state.email}.</p>
      ) : null}
      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
