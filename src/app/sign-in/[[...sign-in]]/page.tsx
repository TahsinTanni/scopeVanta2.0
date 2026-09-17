import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center py-16 bg-surface-0">
      <SignIn />
    </div>
  );
}
