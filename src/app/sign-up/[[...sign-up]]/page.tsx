import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center py-16 bg-surface-0">
      <SignUp />
    </div>
  );
}
