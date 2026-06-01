"use client";
import { useActionState } from "react";
import {
  saveNeonCredentialAction,
  saveVercelCredentialAction,
  type StoreCredentialResult,
} from "./actions";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { 
  IconBrandVercel, 
  IconTriangleSquareCircle, 
  IconDeviceFloppy, 
  IconLoader2 
} from "@tabler/icons-react";

export function CredentialForms({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <VercelForm workspaceSlug={workspaceSlug} />
      <NeonForm workspaceSlug={workspaceSlug} />
    </div>
  );
}

function VercelForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState<StoreCredentialResult | null, FormData>(
    saveVercelCredentialAction,
    null,
  );
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-black p-2 text-white dark:bg-white dark:text-black">
            <IconBrandVercel className="size-4" />
          </div>
          <CardTitle className="text-lg">Vercel</CardTitle>
        </div>
        <CardDescription>
          Attach your personal or team access token for automated deployments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="vercel-token">Access Token</FieldLabel>
              <Input
                id="vercel-token"
                name="token"
                type="password"
                required
                minLength={20}
                maxLength={512}
                autoComplete="off"
                placeholder="Managed access token"
                className="bg-background"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="teamId">Team ID (optional)</FieldLabel>
              <Input
                id="teamId"
                name="teamId"
                type="text"
                maxLength={64}
                placeholder="team_..."
                className="bg-background font-mono text-[11px]"
              />
            </Field>

            {state?.ok && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600 border border-emerald-500/20">
                Vercel token saved successfully.
              </div>
            )}

            {state && !state.ok && (
              <FieldError errors={[{ message: state.error }]} />
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? (
                <>
                  <IconLoader2 className="animate-spin" data-icon="inline-start" />
                  Saving...
                </>
              ) : (
                <>
                  <IconDeviceFloppy data-icon="inline-start" />
                  Save Vercel Token
                </>
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function NeonForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState<StoreCredentialResult | null, FormData>(
    saveNeonCredentialAction,
    null,
  );
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-500 p-2 text-white">
            <IconTriangleSquareCircle className="size-4" />
          </div>
          <CardTitle className="text-lg">Neon</CardTitle>
        </div>
        <CardDescription>
          Account API key used to provision databases for your projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="neon-token">API Key</FieldLabel>
              <Input
                id="neon-token"
                name="token"
                type="password"
                required
                minLength={20}
                maxLength={512}
                autoComplete="off"
                placeholder="Managed API key"
                className="bg-background"
              />
            </Field>

            {state?.ok && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600 border border-emerald-500/20">
                Neon key saved successfully.
              </div>
            )}

            {state && !state.ok && (
              <FieldError errors={[{ message: state.error }]} />
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? (
                <>
                  <IconLoader2 className="animate-spin" data-icon="inline-start" />
                  Saving...
                </>
              ) : (
                <>
                  <IconDeviceFloppy data-icon="inline-start" />
                  Save Neon Key
                </>
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
