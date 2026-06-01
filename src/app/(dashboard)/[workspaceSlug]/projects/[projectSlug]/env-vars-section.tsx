"use client";
import { useState, useActionState } from "react";
import {
  setEnvVarAction,
  removeEnvVarAction,
  type EnvVarResult,
} from "./env-vars-actions";
import type { EnvVarRow } from "@/server/services/env-vars.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  IconPlus,
  IconTrash,
  IconLoader2,
  IconVariable,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface Props {
  workspaceSlug: string;
  projectSlug: string;
  initialVars: EnvVarRow[];
  canManage: boolean;
}

const TARGET_LABELS: Record<string, string> = {
  production: "Production",
  preview: "Preview",
  development: "Development",
};

const TARGET_COLORS: Record<string, string> = {
  production: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  preview: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  development: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
};

export function EnvVarsSection({ workspaceSlug, projectSlug, initialVars, canManage }: Props) {
  const [vars, setVars] = useState<EnvVarRow[]>(initialVars);
  const [showForm, setShowForm] = useState(false);

  function onAdded(row: EnvVarRow) {
    setVars((prev) => {
      // Replace if same key exists (update path)
      const without = prev.filter((v) => v.key !== row.key);
      return [...without, row].sort((a, b) => a.key.localeCompare(b.key));
    });
    setShowForm(false);
  }

  function onRemoved(id: string) {
    setVars((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <IconVariable className="size-4" />
              Environment Variables
            </CardTitle>
            <CardDescription>
              Injected into every deployment. Values are encrypted at rest and pushed directly to Vercel.
            </CardDescription>
          </div>
          {canManage && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <IconPlus className="size-4 mr-1.5" />
              Add Variable
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && canManage && (
          <AddEnvVarForm
            workspaceSlug={workspaceSlug}
            projectSlug={projectSlug}
            onAdded={onAdded}
            onCancel={() => setShowForm(false)}
          />
        )}

        {vars.length === 0 && !showForm ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed bg-muted/30 py-10 text-center">
            <IconVariable className="size-8 text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="text-sm font-medium">No environment variables</p>
              <p className="text-xs text-muted-foreground">
                Add keys like <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">DATABASE_URL</code> or{" "}
                <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">STRIPE_SECRET_KEY</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {vars.map((v) => (
              <EnvVarRow
                key={v.id}
                row={v}
                workspaceSlug={workspaceSlug}
                projectSlug={projectSlug}
                canManage={canManage}
                onRemoved={() => onRemoved(v.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function AddEnvVarForm({
  workspaceSlug,
  projectSlug,
  onAdded,
  onCancel,
}: {
  workspaceSlug: string;
  projectSlug: string;
  onAdded: (row: EnvVarRow) => void;
  onCancel: () => void;
}) {
  const [result, action, pending] = useActionState<EnvVarResult | null, FormData>(
    setEnvVarAction,
    null,
  );
  const [key, setKey] = useState("");

  // Propagate success back to parent
  if (result?.ok) {
    // Synthesise a local EnvVarRow so the UI refreshes without a round-trip
    const row: EnvVarRow = {
      id: crypto.randomUUID(),
      key,
      target: ["production"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    onAdded(row);
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
      <p className="text-sm font-medium">New environment variable</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        <input type="hidden" name="projectSlug" value={projectSlug} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="env-key" className="text-xs font-medium">Key</Label>
            <Input
              id="env-key"
              name="key"
              placeholder="NEXT_PUBLIC_APP_URL"
              required
              className="font-mono text-sm"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="env-value" className="text-xs font-medium">Value</Label>
            <Input
              id="env-value"
              name="value"
              type="password"
              placeholder="Enter value…"
              required
              autoComplete="off"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Targets</Label>
          <div className="flex flex-wrap gap-4">
            {(["production", "preview", "development"] as const).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <Checkbox
                  id={`target-${t}`}
                  name="target"
                  value={t}
                  defaultChecked={t === "production"}
                />
                <Label htmlFor={`target-${t}`} className="text-sm font-normal cursor-pointer">
                  {TARGET_LABELS[t]}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {result && !result.ok && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <IconAlertTriangle className="size-3.5 shrink-0" />
            {result.error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <IconLoader2 className="size-3.5 mr-1.5 animate-spin" />}
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EnvVarRow({
  row,
  workspaceSlug,
  projectSlug,
  canManage,
  onRemoved,
}: {
  row: EnvVarRow;
  workspaceSlug: string;
  projectSlug: string;
  canManage: boolean;
  onRemoved: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [result, action, pending] = useActionState<EnvVarResult | null, FormData>(
    removeEnvVarAction,
    null,
  );

  if (result?.ok) onRemoved();

  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 py-3 text-sm", confirmDelete && "bg-destructive/5")}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono font-semibold truncate">{row.key}</span>
        <div className="flex flex-wrap gap-1">
          {(row.target as string[]).map((t) => (
            <Badge
              key={t}
              variant="outline"
              className={cn("text-[9px] h-4 px-1.5", TARGET_COLORS[t])}
            >
              {TARGET_LABELS[t] ?? t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono text-muted-foreground text-xs tracking-wider select-none">
          ●●●●●●●●
        </span>
        {canManage && (
          confirmDelete ? (
            <form action={action} className="flex items-center gap-1.5">
              <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
              <input type="hidden" name="projectSlug" value={projectSlug} />
              <input type="hidden" name="envVarId" value={row.id} />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={pending}
                className="h-7 px-2 text-xs"
              >
                {pending && <IconLoader2 className="size-3 mr-1 animate-spin" />}
                Delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash className="size-3.5" />
              <span className="sr-only">Remove</span>
            </Button>
          )
        )}
      </div>
      {result && !result.ok && (
        <p className="w-full text-xs text-destructive mt-1">{result.error}</p>
      )}
    </div>
  );
}
