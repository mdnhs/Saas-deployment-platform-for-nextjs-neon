import { provisionDeployment } from "./provision-deployment";
import { reconcileDeployments } from "./reconcile-deployments";
import { cleanupProjects } from "./cleanup-projects";
import { verifyDomains } from "./verify-domains";
import { rotateCredentials } from "./rotate-credentials";

export const functions = [
  provisionDeployment,
  reconcileDeployments,
  cleanupProjects,
  verifyDomains,
  rotateCredentials,
];
