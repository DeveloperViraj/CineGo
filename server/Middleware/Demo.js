// server/Middleware/Demo.js
import { getAuth, clerkClient } from "@clerk/express";

export const attachDemoFlag = async (req, _res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { req.isDemo = false; return next(); }
    const u = await clerkClient.users.getUser(userId);
    req.isDemo = u?.privateMetadata?.demo === true;
    req.demoUserId = userId;
  } catch {
    req.isDemo = false;
  }
  next();
};
