"use client";
import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveVercelCredentialAction,
  saveNeonCredentialAction,
  type StoreCredentialResult,
} from "../settings/actions";
import type { OnboardingState } from "@/server/services/onboarding.service";
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
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  IconBrandGithub,
  IconBrandVercel,
  IconDatabase,
  IconRocket,
  IconCircleCheck,
  IconCircle,
  IconLoader2,
  IconExternalLink,
  IconArrowRight,
  IconChevronRight,
} from "@tabler/icons-react";

const STEPS = [
  { id: 1, label: "GitHub", icon: IconBrandGithub },
  { id: 2, label: "Vercel", icon: IconBrandVercel },
  { id: 3, label: "Neon", icon: IconDatabase },
  { id: 4, label: "Launch", icon: IconRocket },
] as const;

interface Props {
  workspaceSlug: string;
  initialState: OnboardingState;
  userId: string;
}

export function OnboardingWizard({ workspaceSlug, initialState }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(initialState.activeStep);
  const [state, setState] = useState(initialState);

  function markStep(step: keyof typeof initialState, value: boolean) {
    setState((s) => ({ ...s, [step]: value }));
  }

  function advance() {
    const next = Math.min(currentStep + 1, 4) as 1 | 2 | 3 | 4;
    setCurrentStep(next);
  }

  function isStepDone(step: 1 | 2 | 3 | 4) {
    if (step === 1) return state.githubConnected;
    if (step === 2) return state.vercelConnected;
    if (step === 3) return state.neonConnected;
    if (step === 4) return state.hasProjects;
    return false;
  }

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <nav className="flex items-center justify-between relative">
        {/* connector line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border -z-10 mx-10" />
        {STEPS.map((step) => {
          const done = isStepDone(step.id as 1 | 2 | 3 | 4);
          const active = currentStep === step.id;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id as 1 | 2 | 3 | 4)}
              className="flex flex-col items-center gap-2"
            >
              <div className={cn(
                "flex size-12 items-center justify-center rounded-full border-2 bg-background transition-all",
                done
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                  : active
                    ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "border-border text-muted-foreground",
              )}>
                {done ? (
                  <IconCircleCheck className="size-6" />
                ) : (
                  <Icon className="size-5" />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium hidden sm:block",
                active ? "text-foreground" : done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}>
                {step.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Step content */}
      <div>
        {currentStep === 1 && (
          <StepGitHub
            connected={state.githubConnected}
            onConnected={() => { markStep("githubConnected", true); advance(); }}
          />
        )}
        {currentStep === 2 && (
          <StepVercel
            workspaceSlug={workspaceSlug}
            connected={state.vercelConnected}
            onSaved={() => { markStep("vercelConnected", true); advance(); }}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <StepNeon
            workspaceSlug={workspaceSlug}
            connected={state.neonConnected}
            onSaved={() => { markStep("neonConnected", true); advance(); }}
            onSkip={() => advance()}
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
          <StepLaunch
            workspaceSlug={workspaceSlug}
            hasProjects={state.hasProjects}
            vercelConnected={state.vercelConnected}
            onDone={() => router.push(`/${workspaceSlug}/projects`)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — GitHub
// ---------------------------------------------------------------------------

function StepGitHub({
  connected,
  onConnected,
}: {
  connected: boolean;
  onConnected: () => void;
}) {
  return (
    <Card className={cn(connected && "border-emerald-500/30 bg-emerald-500/5")}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-zinc-900 p-2.5 text-white dark:bg-zinc-800">
            <IconBrandGithub className="size-5" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Connect GitHub
              {connected && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Connected</Badge>}
            </CardTitle>
            <CardDescription>Needed to browse and select your repositories.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <IconCircleCheck className="size-4" />
              GitHub account is connected.
            </div>
            <Button size="sm" onClick={onConnected}>
              Continue
              <IconChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in with GitHub to allow LaunchFast to read your repositories. You&apos;ll be redirected back here after.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <a href="/api/auth/sign-in/social?provider=github&callbackURL=..">
                <IconBrandGithub className="size-4 mr-2" />
                Connect GitHub
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Vercel
// ---------------------------------------------------------------------------

function StepVercel({
  workspaceSlug,
  connected,
  onSaved,
  onBack,
}: {
  workspaceSlug: string;
  connected: boolean;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [result, action, pending] = useActionState<StoreCredentialResult | null, FormData>(
    saveVercelCredentialAction,
    null,
  );

  if (result?.ok && !connected) {
    onSaved();
  }

  return (
    <Card className={cn(connected && "border-emerald-500/30 bg-emerald-500/5")}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-black p-2.5 text-white">
            <IconBrandVercel className="size-5" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Add Vercel Token
              {connected && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Saved</Badge>}
            </CardTitle>
            <CardDescription>Your personal access token — projects deploy to YOUR Vercel account.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <IconCircleCheck className="size-4" />
              Vercel token saved.
            </div>
            <Button size="sm" onClick={onSaved}>
              Continue
              <IconChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How to get your token:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">vercel.com/account/tokens <IconExternalLink className="size-3" /></a></li>
                <li>Click <strong>Create</strong> → name it "LaunchFast"</li>
                <li>Copy the token and paste below</li>
              </ol>
            </div>

            <form action={action} className="space-y-4">
              <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="vercel-token">Access Token</FieldLabel>
                  <Input
                    id="vercel-token"
                    name="token"
                    type="password"
                    required
                    minLength={20}
                    autoComplete="off"
                    placeholder="Starts with..."
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="teamId">
                    Team ID <span className="text-muted-foreground font-normal">(optional — for team accounts)</span>
                  </FieldLabel>
                  <Input
                    id="teamId"
                    name="teamId"
                    type="text"
                    maxLength={64}
                    placeholder="team_..."
                    className="font-mono text-[11px]"
                  />
                </Field>
              </FieldGroup>

              {result && !result.ok && <FieldError errors={[{ message: result.error }]} />}

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" type="button" onClick={onBack}>
                  Back
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? <IconLoader2 className="animate-spin mr-2 size-4" /> : null}
                  {pending ? "Saving..." : "Save & Continue"}
                  {!pending && <IconArrowRight className="ml-2 size-4" />}
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Neon
// ---------------------------------------------------------------------------

function StepNeon({
  workspaceSlug,
  connected,
  onSaved,
  onSkip,
  onBack,
}: {
  workspaceSlug: string;
  connected: boolean;
  onSaved: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [result, action, pending] = useActionState<StoreCredentialResult | null, FormData>(
    saveNeonCredentialAction,
    null,
  );

  if (result?.ok && !connected) {
    onSaved();
  }

  return (
    <Card className={cn(connected && "border-emerald-500/30 bg-emerald-500/5")}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500 p-2.5 text-white">
            <IconDatabase className="size-5" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Add Neon API Key
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Optional</Badge>
              {connected && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Saved</Badge>}
            </CardTitle>
            <CardDescription>Required only if you want LaunchFast to provision databases automatically.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <IconCircleCheck className="size-4" />
              Neon API key saved.
            </div>
            <Button size="sm" onClick={onSaved}>
              Continue
              <IconChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How to get your API key:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <a href="https://console.neon.tech/app/settings/api-keys" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">console.neon.tech → API Keys <IconExternalLink className="size-3" /></a></li>
                <li>Click <strong>Generate new API key</strong></li>
                <li>Copy and paste below</li>
              </ol>
            </div>

            <form action={action} className="space-y-4">
              <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="neon-token">API Key</FieldLabel>
                  <Input
                    id="neon-token"
                    name="token"
                    type="password"
                    required
                    minLength={20}
                    autoComplete="off"
                    placeholder="neon_..."
                  />
                </Field>
              </FieldGroup>

              {result && !result.ok && <FieldError errors={[{ message: result.error }]} />}

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" type="button" onClick={onBack}>
                  Back
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? <IconLoader2 className="animate-spin mr-2 size-4" /> : null}
                  {pending ? "Saving..." : "Save & Continue"}
                  {!pending && <IconArrowRight className="ml-2 size-4" />}
                </Button>
                <Button variant="ghost" size="sm" type="button" onClick={onSkip} className="text-muted-foreground">
                  Skip for now
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Launch
// ---------------------------------------------------------------------------

function StepLaunch({
  workspaceSlug,
  hasProjects,
  vercelConnected,
}: {
  workspaceSlug: string;
  hasProjects: boolean;
  vercelConnected: boolean;
  onDone: () => void;
}) {
  return (
    <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-blue-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-2.5 text-primary-foreground">
            <IconRocket className="size-5" />
          </div>
          <div>
            <CardTitle>Ready to launch</CardTitle>
            <CardDescription>
              {hasProjects
                ? "You already have projects. Go to your dashboard."
                : "Create your first project and deploy in seconds."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Setup Summary</div>
          <div className="space-y-2">
            <StatusRow label="GitHub" done={true} />
            <StatusRow label="Vercel" done={vercelConnected} />
            <StatusRow label="Neon" done={false} optional />
            <StatusRow label="First Project" done={hasProjects} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {hasProjects ? (
            <Button asChild className="flex-1">
              <Link href={`/${workspaceSlug}/projects`}>
                Go to Projects
                <IconArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild className="flex-1">
              <Link href={`/${workspaceSlug}/projects/new`}>
                Connect your first repo
                <IconArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/${workspaceSlug}/projects`}>
              Skip for now
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  done,
  optional,
}: {
  label: string;
  done: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {done ? (
          <IconCircleCheck className="size-4 text-emerald-500" />
        ) : (
          <IconCircle className="size-4 text-muted-foreground" />
        )}
        <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        {optional && !done && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground">optional</Badge>
        )}
      </div>
      <span className={cn(
        "text-xs font-medium",
        done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
      )}>
        {done ? "Done" : optional ? "Skipped" : "Pending"}
      </span>
    </div>
  );
}
