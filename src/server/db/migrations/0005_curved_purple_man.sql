CREATE TYPE "public"."credential_kind" AS ENUM('api_key', 'oauth_token', 'service_account');--> statement-breakpoint
CREATE TYPE "public"."credential_provider" AS ENUM('vercel', 'neon', 'github');--> statement-breakpoint
CREATE TYPE "public"."database_status" AS ENUM('provisioning', 'ready', 'failed', 'archived');--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "credential_provider" NOT NULL,
	"kind" "credential_kind" NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"key_version" integer NOT NULL,
	"metadata" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"neon_project_id" text,
	"neon_branch_id" text,
	"database_name" text NOT NULL,
	"role_name" text NOT NULL,
	"host" text,
	"status" "database_status" DEFAULT 'provisioning' NOT NULL,
	"metadata" jsonb,
	"created_by" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_active_unique" ON "credentials" USING btree ("workspace_id","provider","kind") WHERE "credentials"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "credentials_workspace_idx" ON "credentials" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "databases_workspace_project_idx" ON "databases" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "databases_neon_project_unique" ON "databases" USING btree ("neon_project_id");