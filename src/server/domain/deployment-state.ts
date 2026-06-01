import type { DeploymentStatus } from "@/server/db/schema";

export const DEPLOYMENT_TERMINAL: ReadonlySet<DeploymentStatus> = new Set([
  "ready",
  "failed",
  "canceled",
]);

/**
 * Explicit allowed transitions. Any pair not in this map is rejected by
 * `transitionDeployment()`. `from === to` is treated as a no-op upstream (so
 * duplicate webhooks don't error), not represented here.
 */
const ALLOWED: Readonly<Record<DeploymentStatus, ReadonlySet<DeploymentStatus>>> = {
  queued: new Set(["provisioning", "failed", "canceled"]),
  provisioning: new Set(["building", "failed", "canceled"]),
  building: new Set(["ready", "failed", "canceled"]),
  ready: new Set(),
  failed: new Set(),
  canceled: new Set(),
};

export function canTransition(
  from: DeploymentStatus,
  to: DeploymentStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from].has(to);
}

export function isTerminal(status: DeploymentStatus): boolean {
  return DEPLOYMENT_TERMINAL.has(status);
}

export class IllegalDeploymentTransition extends Error {
  constructor(
    public readonly from: DeploymentStatus,
    public readonly to: DeploymentStatus,
    public readonly deploymentId: string,
  ) {
    super(`illegal deployment transition ${from} → ${to} (id=${deploymentId})`);
    this.name = "IllegalDeploymentTransition";
  }
}
