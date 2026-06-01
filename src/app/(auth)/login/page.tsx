"use client";
import { useState } from "react";
import { signIn } from "@/server/auth/auth-client";

export default function LoginPage() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(provider: "github" | "google") {
    setPending(provider);
    setError(null);
    try {
      await signIn.social({ provider, callbackURL: "/workspaces" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign-in failed");
      setPending(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-zinc-500">Use GitHub or Google to continue.</p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => go("github")}
          disabled={pending !== null}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
        <button
          type="button"
          onClick={() => go("google")}
          disabled={pending !== null}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          {pending === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </main>
  );
}
