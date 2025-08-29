// server/Middleware/Demo.js
import { getAuth, clerkClient } from "@clerk/express";
export const attachDemoFlag = async (req, _res, next) => {
  req.isDemo = false;
  req.demoUserId = undefined;

  try {
    const { userId } = getAuth(req) || {};
    if (!userId) return next();

    const u = await clerkClient.users.getUser(userId);
    const role = u?.privateMetadata?.role;
    const demoMeta = u?.privateMetadata?.demo === true;

    if (role === "admin") {
      req.isDemo = true;
      req.demoUserId = userId;
      return next();
    }

    const headerCode = req.header("x-demo-passcode");
    const envCode = (process.env.DEMO_CODE || "").trim();

    if (demoMeta || (envCode && headerCode && headerCode === envCode)) {
      req.isDemo = true;
      req.demoUserId = userId;
    }
  } catch {
    // leave defaults
  }

  return next();
};
