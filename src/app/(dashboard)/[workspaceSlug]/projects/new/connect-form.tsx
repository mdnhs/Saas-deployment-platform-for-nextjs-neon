"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  connectRepoAction,
  type ConnectRepoResult,
} from "../actions";
import type { GithubRepoSummary } from "@/server/integrations/github";
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
import { Label } from "@/components/ui/label";
import {
  IconBrandGithub,
  IconSearch,
  IconLoader2,
  IconAlertTriangle,
  IconArrowRight,
  IconLock,
  IconWorld,
  IconGitBranch,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export function ConnectRepoForm({
  workspaceSlug,
  repos,
}: {
  workspaceSlug: string;
  repos: GithubRepoSummary[];
}) {
  const router = useRouter();
  const [result, action, pending] = useActionState<ConnectRepoResult | null, FormData>(
    connectRepoAction,
    null,
  );
  const [selected, setSelected] = useState<GithubRepoSummary | null>(repos[0] ?? null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (result?.ok) router.push(`/${workspaceSlug}/projects/${result.projectSlug}`);
  }, [result, router, workspaceSlug]);

  // Auto-derive name + slug whenever selected repo changes
  useEffect(() => {
    if (!selected) return;
    const repoName = selected.fullName.split("/")[1] ?? "";
    const displayName = repoName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setName(displayName);
    setSlug(repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  }, [selected?.fullName]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Step 1 — Pick repo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-800">
              <IconBrandGithub className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Select repository</CardTitle>
              <CardDescription>Choose the GitHub repo to deploy.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Repo list */}
          <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No repositories found.
              </div>
            ) : (
              filtered.map((repo) => {
                const isSelected = selected?.fullName === repo.fullName;
                return (
                  <button
                    key={repo.fullName}
                    type="button"
                    onClick={() => setSelected(repo)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/5 hover:bg-primary/10",
                    )}
                  >
                    <div className={cn(
                      "flex size-2 shrink-0 rounded-full",
                      isSelected ? "bg-primary" : "bg-muted-foreground/30",
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium truncate",
                          isSelected ? "text-primary" : "text-foreground",
                        )}>
                          {repo.fullName}
                        </span>
                        {repo.private ? (
                          <Badge variant="outline" className="shrink-0 text-[9px] h-4 px-1.5 text-muted-foreground">
                            <IconLock className="size-2.5 mr-0.5" />
                            Private
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-[9px] h-4 px-1.5 text-muted-foreground">
                            <IconWorld className="size-2.5 mr-0.5" />
                            Public
                          </Badge>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{repo.description}</p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                      <IconGitBranch className="size-3" />
                      <span>{repo.defaultBranch}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — Configure */}
      <Card className={cn(!selected && "opacity-60 pointer-events-none")}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold text-sm">
              2
            </div>
            <div>
              <CardTitle className="text-base">Configure project</CardTitle>
              <CardDescription>Name and URL slug for your project.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
            <input type="hidden" name="githubRepo" value={selected?.fullName ?? ""} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-app"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-slug">
                  Slug
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">used in URLs</span>
                </Label>
                <div className="relative">
                  <Input
                    id="project-slug"
                    name="slug"
                    required
                    minLength={2}
                    maxLength={40}
                    pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    className="font-mono text-sm"
                    placeholder="my-app"
                  />
                </div>
              </div>
            </div>

            {result && !result.ok && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <IconAlertTriangle className="size-4 shrink-0" />
                {result.error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={pending || !selected}
                className="gap-2"
              >
                {pending ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconArrowRight className="size-4" />
                )}
                {pending ? "Creating project…" : "Create project"}
              </Button>
              {selected && (
                <p className="text-xs text-muted-foreground">
                  Deploying <span className="font-medium text-foreground">{selected.fullName}</span>
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
