"use client";
import { useActionState, useState } from "react";
import { deleteProjectAction, type DeleteProjectResult } from "../actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconTrash, IconAlertTriangle } from "@tabler/icons-react";

export function DeleteProjectForm({
  workspaceSlug,
  projectId,
  projectName,
}: {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
}) {
  const [confirmValue, setConfirmValue] = useState("");
  const [state, action, pending] = useActionState<DeleteProjectResult | null, FormData>(
    deleteProjectAction,
    null,
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <IconTrash data-icon="inline-start" />
          Delete Project
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <IconAlertTriangle className="size-5" />
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action cannot be undone. This will permanently delete the
              <span className="font-bold text-foreground"> {projectName}</span> project and remove its
              associated Vercel resources and Neon databases.
            </p>
            <div className="space-y-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p>Type <code className="font-mono font-bold text-foreground">delete</code> below to confirm:</p>
              <Input
                placeholder="delete"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
                className="bg-background"
                autoFocus
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="confirm" value={confirmValue} />
            <AlertDialogAction
              type="submit"
              disabled={pending || confirmValue !== "delete"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
        {state && !state.ok && (
          <p className="mt-2 text-center text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
