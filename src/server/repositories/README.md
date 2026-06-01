# Repositories

Tenant-guarded data access. Two non-negotiable rules:

1. **Every tenant-scoped function takes `workspaceId` as a parameter and includes it in
   the `WHERE` clause.** This is the primary defense — RLS is the backup.
2. **Mutations on tenant-scoped tables run inside `withWorkspace(workspaceId, ...)`** so
   the `app.workspace_id` GUC is set and RLS policies fire.

```ts
// good
export async function listProjects(workspaceId: string) {
  return withWorkspace(workspaceId, (tx) =>
    tx.select().from(projects).where(eq(projects.workspaceId, workspaceId)),
  );
}

// bad — missing workspaceId in WHERE; one bug = cross-tenant breach.
export async function listProjects(_workspaceId: string) {
  return db.select().from(projects);
}
```

Services call repositories. Routes/Server Actions never touch `db` directly.
