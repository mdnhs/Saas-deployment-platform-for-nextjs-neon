import type { DeploymentStatus } from "@/server/db/schema";

const TONE: Record<DeploymentStatus, string> = {
  queued: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  provisioning: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  building: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  canceled: "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800",
};

export function StatusPill({ status }: { status: DeploymentStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}
    >
      {status}
    </span>
  );
}
