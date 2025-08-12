// Middleware/Auth.js
import { clerkClient, requireAuth, getAuth } from '@clerk/express';

// Any signed-in user
export const protectUser = requireAuth();

// Only admins
export const protectAdmin = requireAuth(async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const user = await clerkClient.users.getUser(userId);
    if (user?.privateMetadata?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not Authorized' });
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Only the owner(s) listed in OWNER_EMAIL
export const protectOwner = requireAuth(async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const me = await clerkClient.users.getUser(userId);

    const primaryEmail =
      me?.emailAddresses?.find(e => e.id === me.primaryEmailAddressId)?.emailAddress?.toLowerCase();

    const owners = (process.env.OWNER_EMAIL || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (!primaryEmail || !owners.includes(primaryEmail)) {
      return res.status(403).json({ success: false, message: 'Owner only' });
    }
    next();
  } catch (err) {
    next(err);
  }
});
