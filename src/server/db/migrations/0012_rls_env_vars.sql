ALTER TABLE project_env_vars ENABLE ROW LEVEL SECURITY;

CREATE POLICY env_vars_workspace_isolation ON project_env_vars
  USING (workspace_id = app_current_workspace());
