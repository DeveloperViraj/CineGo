// server/Middleware/Demo.js
import { getAuth, clerkClient } from "@clerk/express";

/**
 * Attaches:
 *   req.isDemo     → boolean (allowed to use demo endpoints)
 *   req.demoUserId → string | undefined
 *
 * Rules:
 *  - Real admins are ALWAYS elevated (no passcode needed).
 *  - Non-admins can be elevated if:
 *      a) privateMetadata.demo === true, OR
 *      b) header x-demo-passcode matches process.env.DEMO_CODE
 */
export const attachDemoFlag = async (req, _res, next) => {
  req.isDemo = false;
  req.demoUserId = undefined;

  try {
    const { userId } = getAuth(req) || {};
    if (!userId) return next();

    const u = await clerkClient.users.getUser(userId);
    const role = u?.privateMetadata?.role;
    const demoMeta = u?.privateMetadata?.demo === true;

    // 1) Real admins: auto-elevate
    if (role === "admin") {
      req.isDemo = true;
      req.demoUserId = userId;
      return next();
    }

    // 2) Non-admin: allow via metadata or header passcode
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
