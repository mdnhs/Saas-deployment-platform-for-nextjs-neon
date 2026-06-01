import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  customType,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
});

// -----------------------------------------------------------------------------
// Better Auth core tables. Field NAMES must match Better Auth defaults so its
// drizzle adapter can read/write without column-mapping config. DB columns are
// snake_case (Postgres convention) via explicit Drizzle column names.
// -----------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => ({
    userIdx: index("session_user_idx").on(t.userId),
    expiresIdx: index("session_expires_idx").on(t.expiresAt),
  }),
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    providerAccountIdx: uniqueIndex("account_provider_account_unique").on(
      t.providerId,
      t.accountId,
    ),
    userIdx: index("account_user_idx").on(t.userId),
  }),
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    identifierIdx: index("verification_identifier_idx").on(t.identifier),
  }),
);

// -----------------------------------------------------------------------------
// Tenant model
// -----------------------------------------------------------------------------

export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    slugIdx: uniqueIndex("workspaces_slug_unique").on(t.slug),
    ownerIdx: index("workspaces_owner_idx").on(t.ownerId),
  }),
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    uniqMembership: uniqueIndex("workspace_members_unique").on(t.workspaceId, t.userId),
    userIdx: index("workspace_members_user_idx").on(t.userId),
  }),
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull().default("member"),
    token: text("token").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    tokenIdx: uniqueIndex("invitations_token_unique").on(t.token),
    workspaceEmailIdx: index("invitations_workspace_email_idx").on(t.workspaceId, t.email),
  }),
);

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

export const projectStatus = pgEnum("project_status", [
  "active",
  "archived",
]);

/**
 * Deployment lifecycle. Transitions are enforced in `transitionDeployment()`:
 *   queued → provisioning → building → ready
 *                                   ↘ failed (terminal)
 *                                   ↘ canceled (terminal)
 * `from === to` is an idempotent no-op (so duplicate webhooks don't error).
 */
export const deploymentStatus = pgEnum("deployment_status", [
  "queued",
  "provisioning",
  "building",
  "ready",
  "failed",
  "canceled",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    githubRepo: text("github_repo").notNull(), // "owner/repo"
    githubDefaultBranch: text("github_default_branch").notNull().default("main"),
    vercelProjectId: text("vercel_project_id"),
    status: projectStatus("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    workspaceSlugIdx: uniqueIndex("projects_workspace_slug_unique").on(
      t.workspaceId,
      t.slug,
    ),
    workspaceIdx: index("projects_workspace_idx").on(t.workspaceId),
    vercelIdIdx: uniqueIndex("projects_vercel_id_unique").on(t.vercelProjectId),
  }),
);

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    vercelDeploymentId: text("vercel_deployment_id"),
    status: deploymentStatus("status").notNull().default("queued"),
    commitSha: text("commit_sha"),
    branch: text("branch"),
    /**
     * Minted by the Server Action. Service layer dedupes on it before any external
     * call; Inngest also keys steps by this. Invariant #5.
     */
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    workspaceProjectIdx: index("deployments_workspace_project_idx").on(
      t.workspaceId,
      t.projectId,
    ),
    idempotencyIdx: uniqueIndex("deployments_idempotency_unique").on(
      t.workspaceId,
      t.idempotencyKey,
    ),
    vercelIdIdx: uniqueIndex("deployments_vercel_id_unique").on(t.vercelDeploymentId),
    statusIdx: index("deployments_status_idx").on(t.status),
  }),
);

/**
 * Append-only audit + debug trail. Every state transition, every webhook, every
 * reconciliation should drop an event here in the SAME transaction as the state
 * write. Never delete. Never update.
 */
export const resourceEvents = pgTable(
  "resource_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    actor: text("actor").notNull(), // "user:<id>" | "webhook:vercel" | "inngest:<fn>" | "reconciler"
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    resourceIdx: index("resource_events_resource_idx").on(
      t.workspaceId,
      t.resourceType,
      t.resourceId,
    ),
    createdAtIdx: index("resource_events_created_at_idx").on(t.createdAt),
  }),
);

// -----------------------------------------------------------------------------
// Secrets (envelope-encrypted; see src/server/security/crypto.ts)
// -----------------------------------------------------------------------------

export const credentialProvider = pgEnum("credential_provider", [
  "vercel",
  "neon",
  "github",
]);

export const credentialKind = pgEnum("credential_kind", [
  "api_key",
  "oauth_token",
  "service_account",
]);

/**
 * Sealed third-party credentials. We store ONLY the ciphertext + IV + auth_tag
 * + key_version; plaintext lives on the wire and in memory at the integration
 * boundary, never on disk and never in logs. AAD bound at seal time is
 * `workspaceId:provider:kind` — a leaked row can't be replayed against a
 * different (workspaceId, provider, kind) combination.
 *
 * The `metadata` column holds non-sensitive context (e.g. Vercel team slug,
 * Neon account email) so we can display "what credential is configured" in the
 * UI without ever decrypting.
 */
export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: credentialProvider("provider").notNull(),
    kind: credentialKind("kind").notNull(),
    ciphertext: bytea("ciphertext").notNull(),
    iv: bytea("iv").notNull(),
    authTag: bytea("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    activeUnique: uniqueIndex("credentials_active_unique")
      .on(t.workspaceId, t.provider, t.kind)
      .where(sql`${t.deletedAt} IS NULL`),
    workspaceIdx: index("credentials_workspace_idx").on(t.workspaceId),
  }),
);

// -----------------------------------------------------------------------------
// Databases (Neon)
// -----------------------------------------------------------------------------

export const databaseStatus = pgEnum("database_status", [
  "provisioning",
  "ready",
  "failed",
  "archived",
]);

/**
 * A Neon project linked to one of our `projects`. We store the Neon project
 * id + database/branch/role names; the connection string is reconstructed at
 * use time from those parts plus a sealed password kept in `credentials` (or,
 * for Phase 4, a sealed Neon API key on the workspace). Storing the parts —
 * not the full DSN — narrows the blast radius of a leak (§8).
 */
export const databases = pgTable(
  "databases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    neonProjectId: text("neon_project_id"),
    neonBranchId: text("neon_branch_id"),
    databaseName: text("database_name").notNull(),
    roleName: text("role_name").notNull(),
    host: text("host"),
    status: databaseStatus("status").notNull().default("provisioning"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    workspaceProjectIdx: index("databases_workspace_project_idx").on(
      t.workspaceId,
      t.projectId,
    ),
    neonIdIdx: uniqueIndex("databases_neon_project_unique").on(t.neonProjectId),
  }),
);

/**
 * Webhook delivery ledger. Provider + provider-side delivery id (e.g. Vercel's
 * `x-vercel-id`) uniquely identifies a webhook attempt. We insert before
 * processing — duplicate inserts raise a unique violation, which the handler
 * treats as "already processed, ack and move on". This is defense-in-depth on
 * top of the state-machine `from===to` no-op.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    deliveryId: text("delivery_id").notNull(),
    eventType: text("event_type").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    providerDeliveryIdx: uniqueIndex("webhook_deliveries_provider_delivery_unique").on(
      t.provider,
      t.deliveryId,
    ),
  }),
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type ResourceEvent = typeof resourceEvents.$inferSelect;
export type DeploymentStatus = (typeof deploymentStatus.enumValues)[number];
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type Database = typeof databases.$inferSelect;
export type NewDatabase = typeof databases.$inferInsert;
export type CredentialProvider = (typeof credentialProvider.enumValues)[number];
export type CredentialKind = (typeof credentialKind.enumValues)[number];
