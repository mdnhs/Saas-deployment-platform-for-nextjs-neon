-- Custom SQL migration file, put your code below! --

-- Row Level Security bootstrap.
-- Tenant context is a per-transaction GUC: `app.workspace_id`.
-- Repositories MUST set this with `SET LOCAL app.workspace_id = ...` inside a transaction
-- before any tenant-scoped query. RLS is the SECOND wall; the repo WHERE clause is the first.

ALTER TABLE "workspaces"         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_members"  ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations"        ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Helper: read the tenant GUC; NULL when not in tenant context (admin/migrator path).
CREATE OR REPLACE FUNCTION app_current_workspace() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.workspace_id', true), '')::uuid
$$;--> statement-breakpoint

CREATE POLICY workspaces_tenant_isolation ON "workspaces"
  USING (id = app_current_workspace())
  WITH CHECK (id = app_current_workspace());--> statement-breakpoint

CREATE POLICY workspace_members_tenant_isolation ON "workspace_members"
  USING (workspace_id = app_current_workspace())
  WITH CHECK (workspace_id = app_current_workspace());--> statement-breakpoint

CREATE POLICY invitations_tenant_isolation ON "invitations"
  USING (workspace_id = app_current_workspace())
  WITH CHECK (workspace_id = app_current_workspace());
