import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import LandingPage from "@/components/LandingPage";

// Server wrapper: forwards a signed-in visitor straight through instead of
// showing them marketing copy. Clerk's sign-in/sign-up fallback redirect is
// configured to land back on "/" (NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL),
// so without this check a just-signed-in user got stuck on the landing page
// forever — the (app) layout then takes over and routes to
// /onboarding/workspace, /onboarding, or /dashboard as appropriate.
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return <LandingPage />;
}
