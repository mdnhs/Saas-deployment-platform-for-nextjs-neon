-- RLS for billing tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_workspace_isolation ON subscriptions
  USING (workspace_id = app_current_workspace());

CREATE POLICY usage_records_workspace_isolation ON usage_records
  USING (workspace_id = app_current_workspace());
