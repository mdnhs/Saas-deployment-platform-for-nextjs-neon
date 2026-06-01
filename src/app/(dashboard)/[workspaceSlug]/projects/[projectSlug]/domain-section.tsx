"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  addDomainAction,
  removeDomainAction,
  refreshDomainAction,
  type AddDomainResult,
  type RemoveDomainResult,
  type RefreshDomainResult,
} from "../actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  IconGlobe,
  IconPlus,
  IconCircleCheck,
  IconClock,
  IconRefresh,
  IconTrash,
  IconLoader2,
  IconCopy,
  IconInfoCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface DomainSummary {
  id: string;
  domain: string;
  verifiedAt: Date | null;
  vercelVerification: Array<{ type: string; domain: string; value: string; reason: string }> | null;
  createdAt: Date;
}

export function DomainSection({
  workspaceSlug,
  projectId,
  domains,
  canManage,
}: {
  workspaceSlug: string;
  projectId: string;
  domains: DomainSummary[];
  canManage: boolean;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Custom Domains</h2>
        <Badge variant="secondary" className="px-3 py-1">
          {domains.filter((d) => d.verifiedAt).length}/{domains.length} Verified
        </Badge>
      </div>

      {domains.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="rounded-2xl bg-background p-4 shadow-sm ring-1 ring-foreground/5">
            <IconGlobe className="size-8 text-muted-foreground" />
          </div>
          <div className="mt-4 max-w-sm space-y-2">
            <CardTitle className="text-lg">No custom domains</CardTitle>
            <CardDescription>
              Add a domain and configure DNS to serve your deployment from it.
            </CardDescription>
          </div>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <ul className="divide-y">
            {domains.map((d) => (
              <DomainRow
                key={d.id}
                domain={d}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                canManage={canManage}
              />
            ))}
          </ul>
        </div>
      )}

      {canManage && (
        <Card className="border-primary/10 bg-linear-to-br from-background to-muted/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconPlus className="size-4 text-primary" />
              <CardTitle className="text-lg font-medium">Add Domain</CardTitle>
            </div>
            <CardDescription>
              Enter a domain you own. We&apos;ll add it to Vercel and show you DNS records to configure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddDomainForm workspaceSlug={workspaceSlug} projectId={projectId} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function DomainRow({
  domain,
  workspaceSlug,
  projectId,
  canManage,
}: {
  domain: DomainSummary;
  workspaceSlug: string;
  projectId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [refreshState, refreshAction, refreshPending] = useActionState<RefreshDomainResult | null, FormData>(
    refreshDomainAction,
    null,
  );
  const [removeState, removeAction, removePending] = useActionState<RemoveDomainResult | null, FormData>(
    removeDomainAction,
    null,
  );

  const verified = domain.verifiedAt != null;
  const hasVerification = (domain.vercelVerification?.length ?? 0) > 0;

  return (
    <li className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            verified
              ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10"
              : "bg-muted text-muted-foreground",
          )}>
            {verified ? <IconCircleCheck className="size-5" /> : <IconClock className="size-5" />}
          </div>
          <div className="space-y-0.5">
            <div className="font-mono text-sm font-semibold">{domain.domain}</div>
            <div className="text-[11px] text-muted-foreground">
              Added {new Date(domain.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "capitalize text-[10px]",
              verified
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20",
            )}
          >
            {verified ? "Verified" : "Pending DNS"}
          </Badge>

          {!verified && (
            <form action={(fd) => { refreshAction(fd); setTimeout(() => router.refresh(), 300); }}>
              <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="domainId" value={domain.id} />
              <Button size="sm" variant="outline" type="submit" disabled={refreshPending} className="h-7 gap-1 text-[11px]">
                <IconRefresh className={cn("size-3", refreshPending && "animate-spin")} />
                Check
              </Button>
            </form>
          )}

          {canManage && (
            <form action={(fd) => { removeAction(fd); setTimeout(() => router.refresh(), 300); }}>
              <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="domainId" value={domain.id} />
              <Button
                size="sm"
                variant="ghost"
                type="submit"
                disabled={removePending}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title="Remove domain"
              >
                {removePending ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconTrash className="size-3.5" />}
              </Button>
            </form>
          )}
        </div>
      </div>

      {!verified && hasVerification && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            <IconInfoCircle className="size-3.5" />
            Configure these DNS records at your registrar
          </div>
          {domain.vercelVerification!.map((rec, i) => (
            <div key={i} className="rounded-md bg-background border p-2 space-y-1">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                <span className="bg-muted px-1.5 py-0.5 rounded">{rec.type}</span>
                <span className="font-mono">{rec.domain}</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono text-foreground break-all">{rec.value}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(rec.value)}
                  className="flex-none p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Copy"
                >
                  <IconCopy className="size-3.5" />
                </button>
              </div>
              {rec.reason && (
                <div className="text-[10px] text-muted-foreground">{rec.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {refreshState && !refreshState.ok && (
        <p className="text-[11px] text-destructive">{refreshState.error}</p>
      )}
      {removeState && !removeState.ok && (
        <p className="text-[11px] text-destructive">{removeState.error}</p>
      )}
    </li>
  );
}

function AddDomainForm({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AddDomainResult | null, FormData>(
    addDomainAction,
    null,
  );

  return (
    <form
      action={(fd) => {
        action(fd);
        setTimeout(() => router.refresh(), 300);
      }}
    >
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="projectId" value={projectId} />

      <FieldGroup className="flex-row items-end gap-4">
        <Field className="flex-1">
          <FieldLabel htmlFor="domain">Domain</FieldLabel>
          <Input
            id="domain"
            name="domain"
            type="text"
            required
            placeholder="app.example.com"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Button type="submit" disabled={pending} className="mb-px">
          {pending ? (
            <>
              <IconLoader2 className="animate-spin" data-icon="inline-start" />
              Adding...
            </>
          ) : (
            <>
              <IconPlus data-icon="inline-start" />
              Add Domain
            </>
          )}
        </Button>
      </FieldGroup>

      {state && !state.ok && (
        <div className="mt-4">
          <FieldError errors={[{ message: state.error }]} />
        </div>
      )}
      {state?.ok && (
        <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
          {state.verified
            ? "Domain added and verified."
            : "Domain added. Configure the DNS records shown above."}
        </p>
      )}
    </form>
  );
}
