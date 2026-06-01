import { requireWorkspaceOrRedirect } from "@/server/auth/require-workspace";
import { findSubscription, sumUsage } from "@/server/repositories/billing.repo";
import { countActiveProjects } from "@/server/repositories/projects.repo";
import { PLAN_LIMITS, BILLING_PERIOD_DAYS } from "@/server/domain/plan-limits";
import { UpgradeButton, ManageButton } from "./billing-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  IconCreditCard,
  IconRocket,
  IconLayoutGrid,
  IconDatabase,
  IconGlobe,
  IconCircleCheck,
  IconSparkles,
} from "@tabler/icons-react";

export const dynamic = "force-dynamic";

function UsageBar({
  label,
  used,
  limit,
  icon: Icon,
}: {
  label: string;
  used: number;
  limit: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pct = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const atLimit = limit !== Infinity && used >= limit;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-3.5" />
          <span>{label}</span>
        </div>
        <span className={atLimit ? "font-semibold text-destructive" : "font-medium"}>
          {limit === Infinity ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      {limit !== Infinity && (
        <Progress
          value={pct}
          className={atLimit ? "[&>div]:bg-destructive" : undefined}
        />
      )}
    </div>
  );
}

export default async function BillingPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await requireWorkspaceOrRedirect({ workspaceSlug });

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - BILLING_PERIOD_DAYS);

  const [subscription, deploymentsUsed, projectsCount] = await Promise.all([
    findSubscription(ctx.workspaceId),
    sumUsage({ workspaceId: ctx.workspaceId, metric: "deployment", periodStart }),
    countActiveProjects(ctx.workspaceId),
  ]);

  const plan = (subscription?.status === "canceled" || subscription?.status === "unpaid")
    ? "free"
    : (subscription?.plan ?? "free");

  const limits = PLAN_LIMITS[plan];
  const isPro = plan === "pro" || plan === "enterprise";

  const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY ?? "";

  return (
    <div className="min-h-screen bg-linear-to-b from-muted/50 to-background">
      <main className="mx-auto max-w-5xl space-y-10 p-6 md:p-10">
        <header className="relative overflow-hidden rounded-2xl bg-zinc-900 px-8 py-12 text-white dark:bg-zinc-950">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <IconCreditCard className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{ctx.workspaceName}</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">Billing</h1>
              <p className="text-zinc-400">Manage your subscription and monitor usage.</p>
            </div>
            <Badge
              variant="outline"
              className={
                isPro
                  ? "border-amber-500/30 bg-amber-500/10 py-1.5 text-amber-400 text-sm"
                  : "border-zinc-700 bg-zinc-800/50 py-1.5 text-zinc-300 text-sm"
              }
            >
              {isPro ? <IconSparkles className="size-3.5 mr-1" /> : null}
              {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
            </Badge>
          </div>
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-blue-600/10 blur-3xl" />
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {/* Current plan */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Current Plan</h2>
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg capitalize">{plan}</CardTitle>
                    {subscription?.currentPeriodEnd && (
                      <span className="text-xs text-muted-foreground">
                        Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <CardDescription>
                    {isPro
                      ? "Unlimited projects, deployments, databases, and custom domains."
                      : "Limited to 2 projects, 10 deployments / 30 days, 1 database, no custom domains."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isPro ? (
                    <ManageButton workspaceSlug={workspaceSlug} />
                  ) : (
                    <UpgradeButton
                      workspaceSlug={workspaceSlug}
                      priceId={proPriceId}
                    />
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Usage */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Usage</h2>
                <span className="text-xs text-muted-foreground">Last {BILLING_PERIOD_DAYS} days</span>
              </div>
              <Card>
                <CardContent className="pt-6 space-y-5">
                  <UsageBar
                    label="Deployments"
                    used={deploymentsUsed}
                    limit={limits.deploymentsPerMonth}
                    icon={IconRocket}
                  />
                  <Separator />
                  <UsageBar
                    label="Projects"
                    used={projectsCount}
                    limit={limits.projects}
                    icon={IconLayoutGrid}
                  />
                  <Separator />
                  <UsageBar
                    label="Databases"
                    used={0}
                    limit={limits.databases}
                    icon={IconDatabase}
                  />
                  <Separator />
                  <UsageBar
                    label="Custom Domains"
                    used={0}
                    limit={limits.domains}
                    icon={IconGlobe}
                  />
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Pro plan card */}
          {!isPro && (
            <aside className="space-y-4">
              <Card className="overflow-hidden border-amber-500/20 bg-linear-to-br from-amber-500/5 to-orange-500/5 shadow-lg shadow-amber-500/10">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <IconSparkles className="size-5 text-amber-500" />
                    <CardTitle className="text-lg">Upgrade to Pro</CardTitle>
                  </div>
                  <CardDescription>Everything you need to ship without limits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {[
                      "Unlimited projects",
                      "Unlimited deployments",
                      "Unlimited databases",
                      "Custom domains",
                      "Priority support",
                    ].map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <IconCircleCheck className="size-4 text-emerald-500 flex-none" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-center text-2xl font-bold pt-2">
                    $29 <span className="text-sm font-normal text-muted-foreground">/ month</span>
                  </div>
                  <UpgradeButton workspaceSlug={workspaceSlug} priceId={proPriceId} fullWidth />
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
