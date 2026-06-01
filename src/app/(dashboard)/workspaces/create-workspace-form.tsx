"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createWorkspaceAction, type CreateWorkspaceResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    CreateWorkspaceResult | null,
    FormData
  >(createWorkspaceAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/${state.slug}`);
  }, [state, router]);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="Acme Corp"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="slug">Slug</FieldLabel>
          <Input
            id="slug"
            name="slug"
            required
            minLength={2}
            maxLength={40}
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
            placeholder="acme"
          />
        </Field>
        
        {state && !state.ok ? (
          <FieldError errors={[{ message: state.error }]} />
        ) : null}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Creating…" : "Create workspace"}
        </Button>
      </FieldGroup>
    </form>
  );
}
