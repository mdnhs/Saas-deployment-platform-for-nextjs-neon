CREATE TABLE IF NOT EXISTS "project_env_vars" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "ciphertext" bytea NOT NULL,
  "iv" bytea NOT NULL,
  "auth_tag" bytea NOT NULL,
  "key_version" integer NOT NULL,
  "vercel_env_id" text,
  "target" text[] NOT NULL DEFAULT ARRAY['production']::text[],
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "env_vars_active_unique"
  ON "project_env_vars" ("workspace_id", "project_id", "key")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "env_vars_project_idx"
  ON "project_env_vars" ("workspace_id", "project_id");
