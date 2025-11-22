// server/Middleware/Auth.js
// Purpose: Central place for all access-control checks.
// These middleware functions decide whether a request should be allowed,
// based on whether the user is logged in, an admin, or the project owner.

import { clerkClient, requireAuth, getAuth } from '@clerk/express';

// Any signed-in user
// If the user is not logged in, Clerk will block the request automatically.
// Used for routes that simply require authentication.
export const protectUser = requireAuth();

// Admin-only access
// This middleware allows any authenticated user BUT also checks
// if they have the admin role in Clerk.
// If not, the request is stopped immediately.
export const protectAdmin = requireAuth(async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const user = await clerkClient.users.getUser(userId);

    if (user?.privateMetadata?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not Authorized',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Owner-only access
// Owner = top-most role. Usually the actual creator of the project.
// Instead of checking a role in metadata, we check if the user's email
// matches one of the OWNER_EMAILs listed in the env file.
export const protectOwner = requireAuth(async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const me = await clerkClient.users.getUser(userId);

    const primaryEmail = me?.emailAddresses
      ?.find(e => e.id === me.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    // OWNER_EMAIL can contain multiple emails, comma-separated
    const owners = (process.env.OWNER_EMAIL || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (!primaryEmail || !owners.includes(primaryEmail)) {
      return res.status(403).json({
        success: false,
        message: 'Owner only',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
});
