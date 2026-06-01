-- Custom SQL migration file, put your code below! --

ALTER TABLE "credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "databases"   ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY credentials_tenant_isolation ON "credentials"
  USING (workspace_id = app_current_workspace())
  WITH CHECK (workspace_id = app_current_workspace());--> statement-breakpoint

CREATE POLICY databases_tenant_isolation ON "databases"
  USING (workspace_id = app_current_workspace())
  WITH CHECK (workspace_id = app_current_workspace());
