# Deployment Platform — Architecture & Build Guide

A multi-tenant SaaS that orchestrates third-party infrastructure (Vercel, Neon, GitHub) on behalf of users: connect a repo, provision a database, deploy, attach a domain. This document is the source of truth for how the system is structured and the order in which to build it.

## 1. Guiding Principles

The product is **not** a CRUD app. It is a **deployment orchestrator**. Its value is the reliability of a chain of operations that span three external APIs, each of which fails partially and independently. Every design decision below follows from that.

1. **Build for partial failure from line one.** Any external call can succeed, fail, time out, or succeed-but-never-tell-you. The system must converge to a correct state regardless.
2. **Webhooks are the source of truth, not API responses.** A `200 OK` from Vercel means "request accepted," not "deployment ready." State is written by webhooks and reconciliation jobs, never optimistically.
3. **Tenant isolation is enforced, not conventional.** Every query carries a workspace context. One forgotten `WHERE workspace_id = ?` is a cross-tenant data breach.
4. **Thin controllers, fat services.** Server Actions and Hono routes contain zero business logic. They authenticate, resolve tenant context, and call a service.
5. **Secrets never rest in plaintext and never appear in logs.**
6. **Every mutation that touches an external API is idempotent.** Double-clicks, webhook redelivery, and job retries must not create duplicate paid resources.

## 2. High-Level Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                         Browser                            │
│                  Next.js App (Dashboard)                   │
└───────────────┬───────────────────────────┬───────────────┘
                │                           │
       Server Actions                  Hono API
     (authenticated UI                (public API +
        mutations)                      webhooks)
                │                           │
                └─────────────┬─────────────┘
                              ▼
                    ┌───────────────────┐
                    │   Service Layer   │  ← all business logic
                    │ (tenant-scoped)   │
                    └─────────┬─────────┘
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       Repository Layer   Integrations    Inngest
       (tenant-guarded     (Vercel /      (background
        DB access)         Neon /         jobs, retries,
              │            GitHub)        reconciliation)
              ▼               │               │
        Neon Postgres    External APIs   Event queue
        (+ RLS, +        ────────────────────┘
         encrypted            │
         credentials)    Webhooks back in via Hono
```

Two entry doors (Server Actions for the UI, Hono for public API and webhooks) converge on **one** service layer. Neither door holds logic. This is the single most important structural rule — enforce it in code review or it rots.

## 3. Tech Stack

| Concern               | Choice                                    | Why                                                            |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Framework             | Next.js (App Router)                      | One app for UI + Server Actions; deploys to Vercel             |
| Public API / webhooks | Hono                                      | Lightweight, fast, runs on edge or node, clean middleware      |
| Database              | Neon Postgres                             | Serverless, branchable, supports RLS for tenant isolation      |
| ORM                   | Drizzle                                   | Type-safe, SQL-first, no hidden magic, great migrations        |
| Auth                  | Better Auth                               | GitHub + Google providers, session management, extensible      |
| Background jobs       | Inngest                                   | Vercel-friendly, durable steps, built-in retries & idempotency |
| Secrets               | AES-256-GCM envelope encryption + KMS     | Column-level, app-side; KMS in prod                            |
| Billing               | Stripe (global) / SSLCommerz + bKash (BD) | Ledger-based usage metering                                    |

Use the latest stable version of each. Pin nothing by memory; check current releases when you install.

## 4. Project Structure

```text
src/
├── app/
│   ├── (dashboard)/            # authenticated app shell
│   ├── (marketing)/            # public pages
│   ├── api/[[...route]]/       # Hono mount point
│   └── auth/                   # Better Auth routes
│
├── components/
│   ├── ui/                     # primitives (shadcn)
│   ├── dashboard/              # feature components
│   └── shared/
│
├── server/
│   ├── db/                     # Drizzle schema, client, migrations
│   ├── domain/                 # state machines, pure domain logic
│   ├── services/               # business logic — the only place it lives
│   ├── repositories/           # tenant-guarded data access
│   ├── integrations/           # external API clients (vercel/neon/github)
│   ├── security/               # crypto, redaction
│   └── auth/                   # auth config + helpers
│
├── inngest/
│   ├── client.ts
│   └── functions/              # workers + reconciliation jobs
│
├── hono/
│   ├── routes/                 # public API + webhook handlers
│   ├── middlewares/            # signature verification, tenant resolution
│   └── index.ts
│
├── lib/                        # framework-agnostic helpers
└── types/
```

## 5. Data Model

Every tenant-scoped table carries `workspace_id`. Add it from day one — retrofitting is painful.

### Core tenancy

- **users** — `id, name, email, avatar, created_at`
- **workspaces** — `id, name, slug, owner_id, created_at`
- **workspace_members** — `id, workspace_id, user_id, role`
- **invitations** — `id, workspace_id, email, role, token, expires_at, accepted_at`

### Resources

- **projects** — `id, workspace_id, name, slug, github_repo, vercel_project_id, status, deleted_at, created_at`
- **databases** — `id, workspace_id, project_id, neon_project_id, database_name, status, deleted_at`
- **domains** — `id, workspace_id, project_id, domain, verified, deleted_at`
- **deployments** — `id, workspace_id, project_id, vercel_deployment_id, status, commit_sha, idempotency_key, started_at, finished_at, created_at`

### State, secrets, billing

- **resource_events** — `id, workspace_id, resource_type, resource_id, from_state, to_state, actor, payload jsonb, created_at` — append-only event log; audit trail + debugging lifeline
- **credentials** — `id, workspace_id, provider, kind, ciphertext, iv, auth_tag, key_version, created_at` — sealed secrets only, never plaintext
- **subscriptions** — `id, workspace_id, plan, status, provider_customer_id, current_period_end`
- **usage_records** — `id, workspace_id, metric, quantity, recorded_at` — billing is a ledger, not a `plan` flag

Notes:

- **Soft deletes everywhere** (`deleted_at`). A hard-deleted project leaves a live Vercel deployment and a billable Neon DB orphaned. A cleanup job tears down external resources, _then_ the row goes.
- **Status columns are written only by webhook handlers and reconciliation jobs**, validated through the state machine (§7).

## 6. Tenant Isolation (defense in depth)

1. **Repository layer** — every query function takes a `workspaceId` and includes it in the `WHERE`. No raw DB access from services.
2. **Postgres RLS** — enable Row-Level Security on Neon as a second wall. Even a buggy query can't cross tenants.
3. **Request context** — `requireWorkspace()` resolves and verifies membership before any handler runs; the resolved `workspaceId` is threaded through every call.

## 7. The Deployment State Machine

Status is not a free-form string. Transitions are explicit and guarded. The Server Action only moves a resource _into_ a pending state; webhooks and the reconciler move it out.

```text
queued → provisioning → building → ready
   │           │            │
   └───────────┴────────────┴──→ failed / canceled   (terminal)
```

- **Server Action**: creates the row in `queued`, emits an Inngest event, returns immediately. Never sets `ready`.
- **Inngest worker**: `queued → provisioning`, calls Vercel, attaches the external ID. Stops there.
- **Vercel webhook**: `provisioning → building → ready` (or `failed`). The source of truth.
- **Reconciler** (cron): finds rows stuck past a timeout, polls Vercel directly, forces the correct terminal state. Catches lost webhooks.

A single guarded `transitionDeployment()` function is the only code allowed to write `deployments.status`. It runs `SELECT … FOR UPDATE` inside a transaction (so concurrent webhooks serialize), treats `from === to` as an idempotent no-op, rejects illegal transitions loudly, and appends to `resource_events` in the same transaction.

## 8. Secrets Handling

**Envelope encryption.** A master key (KMS in prod, 32-byte env var in dev) protects per-secret data. The `credentials` table stores only `ciphertext + iv + auth_tag + key_version`.

- `seal(plaintext)` → AES-256-GCM, random 96-bit IV, returns sealed blob.
- `open(sealed)` → decrypts; the GCM auth tag detects tampering (throws on mismatch).
- Decrypt **only at the moment of use**, at the integration boundary. Never log it, never persist it, never return it to the client.
- `key_version` enables master-key rotation without downtime: decrypt with old, re-seal with new in a background job.
- For Neon connection strings, prefer storing components and reconstructing the DSN at call time over sealing the whole string — a leak then exposes less.
- Add a **redaction filter to the logger** so a decrypted value can never accidentally print.

## 9. Idempotency

- Every deployment/database row gets an `idempotency_key` (UUID minted by the Server Action).
- The service layer dedupes on it before any external call.
- Inngest `step.run(...)` makes each step idempotent across retries — a completed step is never re-run.
- Webhook handlers treat redelivery as a no-op via the state machine's `from === to` check.

## 10. Webhook Security

- **Verify signatures** on every inbound webhook (Vercel, GitHub sign payloads; reject unsigned).
- **Reject replays** — combine signature verification with the idempotent state machine.
- Resolve the external ID → internal `(deploymentId, workspaceId)` before acting.

---

# Step-by-Step Build Guide

Build in this order. Each phase produces something testable. Do **not** reorder — later phases assume the guarantees of earlier ones.

### Phase 0 — Foundations

1. Scaffold the Next.js app and the folder structure in §4.
2. Set up Drizzle + Neon connection, create the migration pipeline.
3. Write the core tenancy schema: `users, workspaces, workspace_members`.
4. Enable Postgres RLS on Neon; add the repository-layer tenant guard.
5. Wire the logger **with the redaction filter** now, before any secret exists.

### Phase 1 — Auth & Workspace

6. Integrate Better Auth with GitHub + Google providers.
7. Implement `requireWorkspace()` request context + membership check.
8. Build create-workspace flow and the `invitations` table + invite acceptance.

### Phase 2 — The Deploy Loop (the actual product)

9. Add `projects`, `deployments`, `resource_events` tables.
10. Implement the deployment **state machine** (`server/domain`) and the guarded `transitionDeployment()` (§7).
11. Set up Inngest: client + the `provision-deployment` worker.
12. Build the integrations layer for GitHub (list repos) and Vercel (create project, create deployment).
13. Server Action: connect repo → create project → `createDeployment()` (queues + emits event).
14. Mount Hono; implement the **Vercel webhook** with signature verification → drives `building → ready`.
15. Dashboard: projects list + live deployment status (read from `status`, updated by webhook).

**At this point you have a shippable MVP: GitHub auth → connect repo → deploy → see status.**

### Phase 3 — Resilience

16. Write the **reconciliation cron** for deployments stuck past timeout.
17. Add idempotency keys end-to-end; verify with a double-click + duplicate-webhook test.
18. Add soft deletes + the external-resource cleanup job.

### Phase 4 — Secrets & Multi-provider DB

19. Implement the crypto module + `credentials` table (§8).
20. Implement `credential.service` (store/use) and route all OAuth tokens through it.
21. Add Neon integration: OAuth/API-key connect → create database → store metadata.

### Phase 5 — Domains

22. Add `domains` table + DNS verification + SSL provisioning flow. (Multi-week; deliberately last.)

### Phase 6 — Billing

23. Add `subscriptions` + `usage_records`.
24. Emit usage events from the service layer (deployments, DB hours, bandwidth).
25. Integrate Stripe (global); add SSLCommerz + bKash for Bangladesh later.
26. Enforce plan limits at the service layer using the usage ledger.

### Phase 7 — Hardening for production

27. Swap env master key → AWS KMS (the `seal`/`open` interface is unchanged).
28. Add master-key rotation background job.
29. Backfill/verify RLS policies; run a cross-tenant access test suite.
30. Add observability: structured logs, the `resource_events` timeline per resource, alerting on stuck-state counts.

---

## What to Cut From MVP (and why)

- **Custom domains** — DNS verification + SSL provisioning is a multi-week sink. Ship in Phase 5, not at launch.
- **Multi-provider DB** — Neon DB creation is Phase 4. The launch loop doesn't need it.

The launch loop is: **GitHub auth → connect repo → deploy to Vercel → see status.** Everything else is iteration.

## The One Risk to Keep in Mind

Orchestrating someone else's infrastructure means inheriting all of their failure modes. The state machine, webhook-as-truth, reconciliation, and idempotency are not gold-plating — they are the product. Build them first.
