// server/Routes/adminrouter.js
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
import { protectAdmin, protectOwner, protectUser } from '../Middleware/Auth.js';

const adminRouter = express.Router();

// checks
adminRouter.get('/isAdmin', protectUser, isAdmin);
adminRouter.get('/isOwner', protectUser, isOwner);

// owner-only admin management
adminRouter.get('/admins', protectOwner, listAdmins);
adminRouter.post('/grant', protectOwner, grantAdmin);
adminRouter.post('/revoke', protectOwner, revokeAdmin);

// admin-only data
adminRouter.get('/dashboarddata', protectAdmin, adminDashboarddata);
adminRouter.get('/getallshows', protectAdmin, getallshows);
adminRouter.get('/getallbookings', protectAdmin, getbookings);

// demo: elevation endpoint for non-admin sandbox users (kept as-is)
adminRouter.post('/demo-elevate', protectUser, demoElevate);

// IMPORTANT: demo create-show should be available to signed-in users,
// the handler will enforce demo permissions (req.isDemo or admin).
adminRouter.post('/demo-show', protectUser, demoCreateShow);

export default adminRouter;

