"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { refreshDeploymentAction, type RefreshResult } from "../actions";
import { Button } from "@/components/ui/button";
import { IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

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
      <Button
        type="submit"
        disabled={pending}
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        title="Poll Vercel for latest status"
      >
        <IconRefresh className={cn("size-3.5", pending && "animate-spin")} />
        <span className="sr-only">Refresh</span>
      </Button>
      {state && !state.ok ? <span className="text-[10px] text-destructive font-medium">{state.error}</span> : null}
    </form>
  );
}
