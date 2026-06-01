-- RLS for domains table
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY domains_workspace_isolation ON domains
  USING (workspace_id = app_current_workspace());
