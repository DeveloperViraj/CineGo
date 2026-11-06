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
import { runAutoSchedule, autoScheduleStatus } from '../Control/Showcontrol.js';

import {
  protectAdmin,
  protectRealAdmin,
  protectOwner,
  protectUser
} from '../Middleware/Auth.js';

const adminRouter = express.Router();

// -------- Role checks --------
// These let the frontend know whether the user is admin or owner.
adminRouter.get('/isAdmin', protectUser, isAdmin);
adminRouter.get('/isOwner', protectUser, isOwner);

// -------- Owner-only routes --------
// Only the owner (OWNER_EMAIL) can view all admins or change admin roles.
adminRouter.get('/admins', protectOwner, listAdmins);
adminRouter.post('/grant', protectOwner, grantAdmin);
adminRouter.post('/revoke', protectOwner, revokeAdmin);

// -------- Admin-only routes --------
// Demo admins can use these too; the handlers keep their data sandboxed/anonymised.
adminRouter.get('/dashboarddata', protectAdmin, adminDashboarddata);
adminRouter.get('/getallshows', protectAdmin, getallshows);
adminRouter.get('/getallbookings', protectAdmin, getbookings);
adminRouter.get('/schedule-status', protectAdmin, autoScheduleStatus);

// Real admins only: changes the public catalog
adminRouter.post('/sync-shows', protectRealAdmin, runAutoSchedule);

// -------- Demo --------
adminRouter.post('/demo-elevate', protectUser, demoElevate);
// protectAdmin attaches req.roles so demo admins get private sandbox shows
adminRouter.post('/demo-show', protectAdmin, demoCreateShow);

export default adminRouter;
