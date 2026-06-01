"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction, type AcceptInviteResult } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AcceptInviteResult | null, FormData>(
    acceptInviteAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.push(`/${state.workspaceSlug}`);
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Joining…" : "Accept invite"}
      </button>
      {state && !state.ok ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
