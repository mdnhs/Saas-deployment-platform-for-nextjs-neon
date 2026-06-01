-- Custom SQL migration file, put your code below! --

-- RLS for resource tables. Same model as 0001: enable RLS, attach a policy keyed
-- to the `app.workspace_id` GUC. Repository layer still carries the primary
-- `WHERE workspace_id = ?` — RLS is the second wall.

ALTER TABLE "projects"        ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deployments"     ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY projects_tenant_isolation ON "projects"
  USING (workspace_id = app_current_workspace())
  WITH CHECK (workspace_id = app_current_workspace());--> statement-breakpoint

CREATE POLICY deployments_tenant_isolation ON "deployments"
  USING (workspace_id = app_current_workspace())
  WITH CHECK (workspace_id = app_current_workspace());--> statement-breakpoint

CREATE POLICY resource_events_tenant_isolation ON "resource_events"
  USING (workspace_id = app_current_workspace())
  WITH CHECK (workspace_id = app_current_workspace());
