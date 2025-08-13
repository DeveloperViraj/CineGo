import { useEffect } from "react";
import { useClerk, useUser } from "@clerk/clerk-react";
import DemoUnlock from "../components/DemoUnlock";

export default function Demo() {
  const { openSignIn } = useClerk();
  const { isLoaded, isSignedIn } = useUser();

  // When Clerk is ready and user is signed out, open the modal sign-in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      openSignIn({ afterSignInUrl: "/demo" });
    }
  }, [isLoaded, isSignedIn, openSignIn]);

  // While Clerk is loading, render a tiny placeholder (prevents black flash)
  if (!isLoaded) {
    return <div className="min-h-screen bg-transparent" />;
  }

  // If signed out, the modal is open; show a fallback button just in case
  if (!isSignedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center pt-28">
        <button
          onClick={() => openSignIn({ afterSignInUrl: "/demo" })}
          className="px-4 py-2 rounded-lg bg-primary/80 hover:bg-primary"
        >
          Continue to sign in
        </button>
      </div>
    );
  }

  // Signed in → show the demo unlock UI with enough top padding for the fixed navbar
  return (
    <div className="min-h-[60vh] flex items-start justify-center pt-28 px-6">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">Admin Demo</h1>
        <p className="text-sm opacity-80">
          Enter the demo passcode to preview the admin panel. Your changes are
          sandboxed to your account.
        </p>
        <DemoUnlock />
      </div>
    </div>
  );
}
