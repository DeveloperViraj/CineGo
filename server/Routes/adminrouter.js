// Purpose: All routes that only admins or the project owner should access.
// These are things like checking admin status, viewing dashboard data,
// and managing who gets admin permissions.

import express from 'express';
import {
  adminDashboarddata,
  getallshows,
  getbookings,
  isAdmin,
  isOwner,
  listAdmins,
  grantAdmin,
  revokeAdmin,
  demoElevate,
  demoCreateShow,
} from '../Control/Admincontrol.js';

import {
  protectAdmin,
  protectOwner,
  protectUser
} from '../Middleware/Auth.js';

const adminRouter = express.Router();

// -------- Role checks --------
// These let the frontend know whether the user is admin or owner.
// protectUser = must be logged in.
adminRouter.get('/isAdmin', protectUser, isAdmin);
adminRouter.get('/isOwner', protectUser, isOwner);

// -------- Owner-only routes --------
// The “owner” is basically the highest role.
// Only the owner is allowed to view all admins or change admin roles.
adminRouter.get('/admins', protectOwner, listAdmins);
adminRouter.post('/grant', protectOwner, grantAdmin);
adminRouter.post('/revoke', protectOwner, revokeAdmin);

// -------- Admin-only routes --------
// Regular admins can access dashboard data, shows list, and bookings.
adminRouter.get('/dashboarddata', protectAdmin, adminDashboarddata);
adminRouter.get('/getallshows', protectAdmin, getallshows);
adminRouter.get('/getallbookings', protectAdmin, getbookings);

// Demo-only routes (optional)
// These are used in sandbox/demo versions of the app.
// You can remove these if you're not using demo mode.
adminRouter.post('/demo-elevate', protectUser, demoElevate);
adminRouter.post('/demo-show', protectUser, demoCreateShow);

export default adminRouter;
