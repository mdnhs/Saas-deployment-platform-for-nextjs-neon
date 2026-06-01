<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture

Full architecture and phased build order: [ARCHITECTURE.md](ARCHITECTURE.md). Read it before designing or changing anything in `src/server/`, `src/hono/`, `src/inngest/`, or the data model.

## Non-negotiable invariants

These rules override convenience. Violating them is a bug, not a style choice.

1. **Webhooks are the source of truth.** A `200 OK` from Vercel/Neon/GitHub means "request accepted," not "done." Never write a terminal status (`ready`, `failed`) from a Server Action or API response. Only webhook handlers and the reconciler write terminal states.
2. **Tenant isolation is enforced in three layers.** Every tenant-scoped query takes `workspaceId` and includes it in `WHERE`. Postgres RLS is the second wall. `requireWorkspace()` resolves membership before any handler runs. One missing `WHERE workspace_id = ?` is a cross-tenant breach.
3. **Thin controllers, fat services.** Server Actions and Hono routes contain zero business logic. They authenticate, resolve tenant, call a service in `src/server/services/`. Both entry doors converge on one service layer.
4. **State transitions go through `transitionDeployment()` only.** It runs `SELECT … FOR UPDATE` in a transaction, treats `from === to` as idempotent no-op, rejects illegal transitions, and appends to `resource_events` in the same transaction. No other code writes `deployments.status`.
5. **Every external-API mutation is idempotent.** Mint an `idempotency_key` (UUID) in the Server Action. Service layer dedupes on it. Inngest `step.run(...)` makes each step idempotent across retries.
6. **Secrets never rest in plaintext, never appear in logs.** Use envelope encryption (`seal`/`open`, AES-256-GCM, `key_version`). Decrypt only at the integration boundary. Logger has a redaction filter — keep it.
7. **Webhooks: verify signatures, reject unsigned.** Resolve external ID → internal `(resourceId, workspaceId)` before acting. Redelivery is a no-op via the state machine.
8. **Soft deletes only** (`deleted_at`). A hard delete orphans paid external resources. Cleanup job tears down externals first, then the row.

## Build phase gating

Build order in ARCHITECTURE.md §Phase 0–7 is not a suggestion. Later phases assume guarantees of earlier ones (e.g. tenant guards before any service; redaction filter before any secret). Do not reorder.

MVP loop: GitHub auth → connect repo → deploy to Vercel → see status. Custom domains, Neon DB creation, billing are post-MVP.
