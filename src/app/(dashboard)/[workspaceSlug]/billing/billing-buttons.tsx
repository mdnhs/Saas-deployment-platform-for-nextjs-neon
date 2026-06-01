"use client";
import { useActionState } from "react";
import { upgradeAction, portalAction, type UpgradeResult, type PortalResult } from "./actions";
import { Button } from "@/components/ui/button";
import { IconLoader2, IconSparkles, IconSettings } from "@tabler/icons-react";

export function UpgradeButton({
  workspaceSlug,
  priceId,
  fullWidth,
}: {
  workspaceSlug: string;
  priceId: string;
  fullWidth?: boolean;
}) {
  const [state, action, pending] = useActionState<UpgradeResult | null, FormData>(
    upgradeAction,
    null,
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const successUrl = `${origin}/${workspaceSlug}/billing?upgraded=1`;
  const cancelUrl = `${origin}/${workspaceSlug}/billing`;

  return (
    <form action={action}>
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="priceId" value={priceId} />
      <input type="hidden" name="successUrl" value={successUrl} />
      <input type="hidden" name="cancelUrl" value={cancelUrl} />
      <Button
        type="submit"
        disabled={pending || !priceId}
        className={fullWidth ? "w-full bg-amber-500 hover:bg-amber-600 text-white" : ""}
      >
        {pending ? (
          <IconLoader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <IconSparkles data-icon="inline-start" />
        )}
        {pending ? "Redirecting..." : "Upgrade to Pro"}
      </Button>
      {state && !state.ok && (
        <p className="mt-2 text-xs text-destructive">{state.error}</p>
      )}
      {!priceId && (
        <p className="mt-2 text-xs text-muted-foreground">
          STRIPE_PRICE_PRO_MONTHLY not configured.
        </p>
      )}
    </form>
  );
}

export function ManageButton({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState<PortalResult | null, FormData>(
    portalAction,
    null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? (
          <IconLoader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <IconSettings data-icon="inline-start" />
        )}
        {pending ? "Redirecting..." : "Manage Subscription"}
      </Button>
      {state && !state.ok && (
        <p className="mt-2 text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}
