"use client";
import { useActionState } from "react";
import { deleteCredentialAction, type StoreCredentialResult } from "./actions";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  IconKey, 
  IconTrash, 
  IconCalendarEvent, 
  IconRefresh,
  IconFingerprint,
  IconLoader2
} from "@tabler/icons-react";

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
      <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-muted/30 p-12 text-center">
        <div className="rounded-2xl bg-background p-4 shadow-sm ring-1 ring-foreground/5">
          <IconKey className="size-8 text-muted-foreground" />
        </div>
        <div className="mt-4 max-w-sm space-y-2">
          <CardTitle className="text-lg">No credentials yet</CardTitle>
          <CardDescription>
            Add a Vercel token and Neon API key below to enable automated deployments.
          </CardDescription>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {credentials.map((c) => (
        <Card key={c.id} className="overflow-hidden border-primary/5 transition-all hover:ring-primary/20">
          <CardHeader className="flex flex-row items-center gap-4 bg-muted/30 pb-4">
            <div className="rounded-lg bg-background p-2.5 shadow-xs ring-1 ring-foreground/5">
              <IconFingerprint className="size-5 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base capitalize">{c.provider}</CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase h-5 px-1.5 bg-background">
                  {c.kind}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <IconCalendarEvent className="size-3" />
                  <span>Created {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                {c.rotatedAt && (
                  <div className="flex items-center gap-1">
                    <IconRefresh className="size-3" />
                    <span>Rotated {new Date(c.rotatedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            {!readOnly && (
              <DeleteButton workspaceSlug={workspaceSlug} credentialId={c.id} />
            )}
          </CardHeader>
          {c.metadata && (
            <CardContent className="pt-4 border-t bg-background/50">
              <MetadataLine metadata={c.metadata} />
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function MetadataLine({ metadata }: { metadata: Record<string, unknown> }) {
  const pairs = Object.entries(metadata)
    .filter(([, v]) => typeof v === "string" || typeof v === "number")
    .slice(0, 4);
  if (pairs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {pairs.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{k}</span>
          <code className="text-xs font-mono text-foreground/80">{String(v)}</code>
        </div>
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
    <form action={action}>
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="credentialId" value={credentialId} />
      <Button
        type="submit"
        disabled={pending}
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title="Remove credential"
      >
        {pending ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconTrash className="size-4" />
        )}
        <span className="sr-only">Remove</span>
      </Button>
      {state && !state.ok ? <span className="absolute mt-8 right-0 text-[10px] text-destructive font-medium whitespace-nowrap">{state.error}</span> : null}
    </form>
  );
}
