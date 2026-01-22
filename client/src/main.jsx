import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { AppProvider } from "./context/Appcontext.jsx";
import { Analytics } from "@vercel/analytics/react";

// Clerk publishable key is required on the client to initialize authentication.
// This key is safe to expose and must be prefixed with VITE_ in Vite projects.
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Fail fast if authentication is misconfigured.
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

// React 18 entry point.
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <AppProvider>
        <App />
        <Analytics />
      </AppProvider>
    </ClerkProvider>
  </BrowserRouter>
);
