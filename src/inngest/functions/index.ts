import { provisionDeployment } from "./provision-deployment";
import { reconcileDeployments } from "./reconcile-deployments";
import { cleanupProjects } from "./cleanup-projects";

export const functions = [provisionDeployment, reconcileDeployments, cleanupProjects];
