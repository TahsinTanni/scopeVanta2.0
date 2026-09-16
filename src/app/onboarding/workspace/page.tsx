import { OrganizationList } from "@clerk/nextjs";

// Shown when a signed-in user has no active Clerk organization — replaces
// legacy's implicit "profile === one user" assumption. A workspace is a
// prerequisite for everything else in the app.
export default function WorkspaceOnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-lg font-semibold text-foreground">Choose or create a workspace</h1>
        <OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" afterCreateOrganizationUrl="/dashboard" />
      </div>
    </div>
  );
}
