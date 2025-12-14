// Purpose: Detect whether the current request should run in "demo mode".
// Demo mode allows limited admin-like behavior without affecting real data.
// The middleware attaches two flags on the request:
// - req.isDemo: whether this request is treated as demo
// - req.demoUserId: the user responsible for demo actions

import { getAuth, clerkClient } from "@clerk/express";

export const attachDemoFlag = async (req, _res, next) => {
  // Default values: normal (non-demo) request
  req.isDemo = false;
  req.demoUserId = undefined;

  try {
    // Read authenticated user from Clerk (if logged in)
    const { userId } = getAuth(req) || {};
    if (!userId) return next();

    const u = await clerkClient.users.getUser(userId);
    const role = u?.privateMetadata?.role;
    const demoMeta = u?.privateMetadata?.demo === true;

    // Admin users are always treated as demo-capable
    // This lets admins safely test features without affecting production data
    if (role === "admin") {
      req.isDemo = true;
      req.demoUserId = userId;
      return next();
    }

    // Non-admin demo access:
    // A user can be marked as demo in metadata
    // OR provide a valid demo passcode via request header
    const headerCode = req.header("x-demo-passcode");
    const envCode = (process.env.DEMO_CODE || "").trim();

    if (demoMeta || (envCode && headerCode && headerCode === envCode)) {
      req.isDemo = true;
      req.demoUserId = userId;
    }
  } catch {
    // If anything fails, the request continues as non-demo
  }

  return next();
};
