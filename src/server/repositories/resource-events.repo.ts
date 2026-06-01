import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { withWorkspace } from "@/server/db/tenant";
import { resourceEvents, type ResourceEvent } from "@/server/db/schema";

export async function listEventsForResource(input: {
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  limit?: number;
}): Promise<ResourceEvent[]> {
  return withWorkspace(input.workspaceId, (tx) =>
    tx
      .select()
      .from(resourceEvents)
      .where(
        and(
          eq(resourceEvents.workspaceId, input.workspaceId),
          eq(resourceEvents.resourceType, input.resourceType),
          eq(resourceEvents.resourceId, input.resourceId),
        ),
      )
      .orderBy(desc(resourceEvents.createdAt))
      .limit(input.limit ?? 50),
  );
}
