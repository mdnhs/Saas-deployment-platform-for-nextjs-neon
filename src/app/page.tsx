import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/server/auth/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/workspaces");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Deployment Platform</h1>
      <p className="text-zinc-500">
        Connect a GitHub repo, deploy to Vercel, watch it ship.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Sign in →
      </Link>
    </main>
  );
}
