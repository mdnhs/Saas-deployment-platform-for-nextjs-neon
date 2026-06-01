"use client";
import { useActionState } from "react";
import { inviteMemberAction, type InviteResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { IconSend, IconLoader2 } from "@tabler/icons-react";

export function InviteMemberForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(
    inviteMemberAction,
    null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email Address</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="colleague@example.com"
            className="bg-background"
          />
        </Field>
        
        <Field>
          <FieldLabel htmlFor="role">Workspace Role</FieldLabel>
          <Select name="role" defaultValue="member">
            <SelectTrigger id="role" className="bg-background">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {state?.ok && (
          <div className="rounded-lg bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600 border border-emerald-500/20">
            Invite created for {state.email}.
          </div>
        )}

        {state && !state.ok && (
          <FieldError errors={[{ message: state.error }]} />
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? (
            <>
              <IconLoader2 className="animate-spin" data-icon="inline-start" />
              Sending...
            </>
          ) : (
            <>
              <IconSend data-icon="inline-start" />
              Send Invitation
            </>
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
