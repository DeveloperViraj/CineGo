import { SignedIn, SignedOut, useClerk } from "@clerk/clerk-react";
import { useEffect } from "react";
import DemoUnlock from "../components/DemoUnlock";

export default function Demo() {
  const { openSignIn } = useClerk();

  // Auto-open Clerk modal when user is signed out
  useEffect(() => {
    openSignIn({ afterSignInUrl: "/demo" });
  }, [openSignIn]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <SignedOut>
        {/* Fallback in case popup blockers prevent auto-open */}
        <button
          onClick={() => openSignIn({ afterSignInUrl: "/demo" })}
          className="px-4 py-2 rounded-lg bg-primary/80 hover:bg-primary"
        >
          Continue to sign in
        </button>
      </SignedOut>

      <SignedIn>
        <div className="w-full max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold">Admin Demo</h1>
          <p className="text-sm opacity-80">
            Enter the demo passcode to preview the admin panel. Your changes are sandboxed to your account.
          </p>
          <DemoUnlock />
        </div>
      </SignedIn>
    </div>
  );
}
