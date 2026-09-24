import { notFound, redirect } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import { getStaffContext } from "@/lib/admin/auth";
import { AdminHeader } from "@/components/admin/AdminUI";

// Staff must sign in with a second factor before any admin page opens.
// This is the one admin page reachable without it.
export default async function AdminSecurityPage() {
  const ctx = await getStaffContext();
  if (!ctx) notFound();
  if (ctx.mfaVerified) redirect("/admin");

  return (
    <div className="max-w-4xl">
      <AdminHeader
        title="Two-factor authentication required"
        description="Staff accounts can reach every customer's data, so the admin area only opens for sessions signed in with a second factor."
      />
      <ol className="mb-6 list-decimal space-y-1.5 pl-5 text-sm text-ink-secondary font-body">
        <li>Open the <strong>Security</strong> tab below and add an authenticator app (or another second factor).</li>
        <li>Sign out, then sign back in. You&apos;ll be asked for your code.</li>
        <li>Come back to <code className="font-mono text-ink-primary">/admin</code>.</li>
      </ol>
      <UserProfile routing="hash" />
    </div>
  );
}
