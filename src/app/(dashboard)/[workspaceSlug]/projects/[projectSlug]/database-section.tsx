"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { provisionDatabaseAction, type ProvisionDatabaseResult } from "../actions";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { 
  IconDatabase, 
  IconPlus, 
  IconServer, 
  IconUser, 
  IconCloud,
  IconCircleCheck,
  IconLoader2,
  IconCircleX
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface DatabaseSummary {
  id: string;
  databaseName: string;
  roleName: string;
  host: string | null;
  status: "provisioning" | "ready" | "failed" | "archived";
  neonProjectId: string | null;
  createdAt: Date;
}

const DB_STATUS_CONFIG: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  provisioning: { color: "text-blue-500 bg-blue-500/10 border-blue-500/20", icon: IconLoader2 },
  ready: { color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: IconCircleCheck },
  failed: { color: "text-destructive bg-destructive/10 border-destructive/20", icon: IconCircleX },
  archived: { color: "text-muted-foreground bg-muted border-transparent", icon: IconCircleX },
};

export function DatabaseSection({
  workspaceSlug,
  projectId,
  databases,
  canManage,
}: {
  workspaceSlug: string;
  projectId: string;
  databases: DatabaseSummary[];
  canManage: boolean;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Databases</h2>
        <Badge variant="secondary" className="px-3 py-1">
          {databases.length} Neon Postgres
        </Badge>
      </div>

      {databases.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="rounded-2xl bg-background p-4 shadow-sm ring-1 ring-foreground/5">
            <IconDatabase className="size-8 text-muted-foreground" />
          </div>
          <div className="mt-4 max-w-sm space-y-2">
            <CardTitle className="text-lg">No databases yet</CardTitle>
            <CardDescription>
              Provision a managed Neon Postgres database and attach it to this project.
            </CardDescription>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {databases.map((d) => {
            const config = DB_STATUS_CONFIG[d.status] ?? DB_STATUS_CONFIG.archived;
            const StatusIcon = config.icon;
            
            return (
              <Card key={d.id} className="overflow-hidden border-primary/5 transition-all hover:ring-primary/20">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-background p-2 shadow-xs ring-1 ring-foreground/5">
                        <IconDatabase className="size-4 text-primary" />
                      </div>
                      <CardTitle className="text-base">{d.databaseName}</CardTitle>
                    </div>
                    <Badge variant="outline" className={cn("capitalize gap-1", config.color)}>
                      <StatusIcon className={cn("size-3", d.status === "provisioning" && "animate-spin")} />
                      {d.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconServer className="size-3.5" />
                      <span className="font-mono text-[11px] truncate">{d.host ?? "Assigning host..."}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconUser className="size-3.5" />
                      <span className="font-mono text-[11px]">role: {d.roleName}</span>
                    </div>
                    {d.neonProjectId && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <IconCloud className="size-3.5" />
                        <span className="font-mono text-[11px]">project: {d.neonProjectId}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && (
        <Card className="border-primary/10 bg-linear-to-br from-background to-muted/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconPlus className="size-4 text-primary" />
              <CardTitle className="text-lg font-medium">Provision New Database</CardTitle>
            </div>
            <CardDescription>
              Create a new database instance in your preferred region.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProvisionForm workspaceSlug={workspaceSlug} projectId={projectId} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function ProvisionForm({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ProvisionDatabaseResult | null, FormData>(
    provisionDatabaseAction,
    null,
  );

  return (
    <form
      action={(fd) => {
        action(fd);
        setTimeout(() => router.refresh(), 250);
      }}
    >
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="projectId" value={projectId} />
      
      <FieldGroup className="flex-row items-end gap-4">
        <Field className="flex-1">
          <FieldLabel htmlFor="databaseName">Database Name</FieldLabel>
          <Input
            id="databaseName"
            name="databaseName"
            required
            pattern="[a-z][a-z0-9_]*"
            minLength={2}
            maxLength={63}
            defaultValue="appdb"
            placeholder="my_database"
          />
        </Field>

        <Field className="w-48">
          <FieldLabel htmlFor="regionId">Region</FieldLabel>
          <Select name="regionId" defaultValue="aws-us-east-2">
            <SelectTrigger id="regionId">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aws-us-east-2">aws-us-east-2</SelectItem>
              <SelectItem value="aws-us-east-1">aws-us-east-1</SelectItem>
              <SelectItem value="aws-us-west-2">aws-us-west-2</SelectItem>
              <SelectItem value="aws-eu-central-1">aws-eu-central-1</SelectItem>
              <SelectItem value="aws-ap-southeast-1">aws-ap-southeast-1</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Button type="submit" disabled={pending} className="mb-px">
          {pending ? (
            <>
              <IconLoader2 className="animate-spin" data-icon="inline-start" />
              Provisioning...
            </>
          ) : (
            <>
              <IconPlus data-icon="inline-start" />
              Provision
            </>
          )}
        </Button>
      </FieldGroup>

      {state && !state.ok && (
        <div className="mt-4">
          <FieldError errors={[{ message: state.error }]} />
        </div>
      )}
    </form>
  );
}
