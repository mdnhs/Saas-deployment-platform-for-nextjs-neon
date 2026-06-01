"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession, AuthRequired } from "@/server/auth/require-workspace";
import {
  createWorkspace,
  WorkspaceServiceError,
} from "@/server/services/workspaces.service";

export type CreateWorkspaceResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

const inputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().toLowerCase().min(2).max(40),
});

export async function createWorkspaceAction(
  _prev: CreateWorkspaceResult | null,
  formData: FormData,
): Promise<CreateWorkspaceResult> {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    if (err instanceof AuthRequired) redirect("/login");
    throw err;
  }

  const parsed = inputSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  }

  try {
    const ws = await createWorkspace({ ...parsed.data, ownerId: session.user.id });
    revalidatePath("/workspaces");
    return { ok: true, slug: ws.slug };
  } catch (err) {
    if (err instanceof WorkspaceServiceError) return { ok: false, error: err.message };
    throw err;
  }
}
