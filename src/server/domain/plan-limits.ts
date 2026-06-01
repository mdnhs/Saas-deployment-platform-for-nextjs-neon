import type { SubscriptionPlan } from "@/server/db/schema";

export interface PlanLimits {
  deploymentsPerMonth: number;
  projects: number;
  databases: number;
  domains: number;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    deploymentsPerMonth: 10,
    projects: 2,
    databases: 1,
    domains: 0,
  },
  pro: {
    deploymentsPerMonth: Infinity,
    projects: Infinity,
    databases: Infinity,
    domains: Infinity,
  },
  enterprise: {
    deploymentsPerMonth: Infinity,
    projects: Infinity,
    databases: Infinity,
    domains: Infinity,
  },
};

export const BILLING_PERIOD_DAYS = 30;
