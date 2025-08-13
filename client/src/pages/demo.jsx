import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import DemoUnlock from "../components/DemoUnlock";

export default function Demo() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <SignedOut>
        <div className="w-full max-w-md">
          <SignIn fallbackRedirectUrl="/demo" />
        </div>
      </SignedOut>

      <SignedIn>
        <div className="w-full max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold">Admin Demo</h1>
          <p className="text-sm opacity-80">
            Enter the demo passcode to preview the admin panel. Your changes are sandboxed and
            visible only to you.
          </p>
          <DemoUnlock />
        </div>
      </SignedIn>
    </div>
  );
}
