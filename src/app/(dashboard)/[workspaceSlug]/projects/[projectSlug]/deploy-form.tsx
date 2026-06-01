"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { deployAction, type DeployResult } from "../actions";
import { Button } from "@/components/ui/button";
import { IconRocket } from "@tabler/icons-react";

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
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="bg-white text-black hover:bg-zinc-200 dark:bg-white dark:text-black"
      >
        <IconRocket data-icon="inline-start" />
        {pending ? "Queueing…" : "Deploy"}
      </Button>
      {state && !state.ok ? <p className="text-xs text-red-600 font-medium">{state.error}</p> : null}
    </form>
  );
}
