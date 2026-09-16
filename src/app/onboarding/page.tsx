import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";

// Replaces legacy App.tsx's `if (!profile.onboarded)` branch (lines
// 1904-2123). Only Owner/Admin can complete workspace setup (company
// profile + plan/checkout) per CLAUDE.md; a Member who lands here before
// setup is done sees a waiting screen instead of a billing form.
export default async function OnboardingPage() {
  const { orgId } = await auth();
  if (!orgId) redirect("/onboarding/workspace");

  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: orgId } });
  if (profile?.onboarded) redirect("/dashboard");

  const ctx = await requireWorkspaceAuth();
  if (ctx.role === "MEMBER") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-foreground">Almost there</h1>
          <p className="mt-2 text-sm text-foreground-muted">Your workspace owner still needs to finish setting up the company profile and plan before you can start.</p>
        </div>
      </div>
    );
  }

  return <OnboardingForm initialProfile={profile} isOwner={ctx.role === "OWNER"} />;
}
