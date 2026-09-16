import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Landing page — legacy App.tsx's "Landing/pricing" public state (list of
// SCOPEVANTA_COMPLETE_HANDOFF.md §3 public states) reduced to its essential
// job: route signed-in users into the app, give signed-out visitors a way
// in. Full marketing content wasn't specified anywhere in the legacy source
// I read (it was minified inline JSX, not something to reconstruct
// speculatively) — see Step 5 report.
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">ScopeVanta</h1>
      <p className="mt-3 max-w-md text-sm text-foreground-muted">Commercial intelligence for service businesses. Analyze → Clarify → Scope → Price → Propose → Win → Protect.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/sign-in" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90">Sign in</Link>
        <Link href="/sign-up" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-raised">Create an account</Link>
      </div>
    </div>
  );
}
