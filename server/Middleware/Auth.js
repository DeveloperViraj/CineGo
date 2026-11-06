// server/Middleware/Auth.js
// Purpose: Central place for all access-control checks.
//
// NOTE: the previous version wrapped the role checks in Clerk's
// `requireAuth(async (req, res, next) => ...)`. requireAuth() only accepts an
// *options object*, so the function was silently ignored and every signed-in
// user passed `protectAdmin` and `protectOwner` (anyone could grant themselves
// admin). These middlewares now perform the checks explicitly and always answer
// API clients with JSON (401/403) instead of an HTML redirect.

import { getAuth } from "@clerk/express";
import { getClerkUser, rolesOf, ensureAdminRoleSaved } from "../lib/clerkUsers.js";

const unauthorized = (res) =>
  res.status(401).json({ success: false, message: "Please sign in to continue" });

const forbidden = (res, message = "Not Authorized") =>
  res.status(403).json({ success: false, message });

// Any signed-in user
export const protectUser = (req, res, next) => {
  const { userId } = getAuth(req) || {};
  if (!userId) return unauthorized(res);
  req.userId = userId;
  next();
};

// Load the Clerk user + roles once and attach them to the request.
async function loadRoles(req) {
  const { userId } = getAuth(req) || {};
  if (!userId) return null;
  const user = await getClerkUser(userId);
  req.userId = userId;
  req.clerkUser = user;
  req.roles = rolesOf(user);
  return req.roles;
}

// Admin-only access (real admins AND sandboxed demo admins).
// Handlers that change public data must check `req.roles.demo` themselves.
export const protectAdmin = async (req, res, next) => {
  try {
    const roles = await loadRoles(req);
    if (!roles) return unauthorized(res);
    if (!roles.admin) return forbidden(res);
    await ensureAdminRoleSaved(req.clerkUser);
    // Kept for backwards compatibility with controllers that read these flags
    req.isDemo = roles.demo;
    req.demoUserId = roles.demo ? req.userId : undefined;
    next();
  } catch (err) {
    next(err);
  }
};

// Real admins only (blocks demo/sandbox admins). Used for anything that
// changes public data or exposes other users' personal details.
export const protectRealAdmin = async (req, res, next) => {
  try {
    const roles = await loadRoles(req);
    if (!roles) return unauthorized(res);
    if (!roles.realAdmin) {
      return forbidden(res, roles.demo ? "Not available in demo mode" : "Not Authorized");
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Owner-only access: email must be listed in OWNER_EMAIL (comma-separated).
export const protectOwner = async (req, res, next) => {
  try {
    const roles = await loadRoles(req);
    if (!roles) return unauthorized(res);
    if (!roles.owner) return forbidden(res, "Owner only");
    next();
  } catch (err) {
    next(err);
  }
};
