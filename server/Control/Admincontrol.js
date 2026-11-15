// Purpose: Admin and owner controllers for CineGo.
// These handlers power the admin dashboard, admin management (grant/revoke), lists,
// and demo helpers used in sandbox mode.
// Authorization happens in Middleware/Auth.js; handlers only add demo-mode rules.

import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import DemoShow from "../models/DemoShow.js";
import { clerkClient, getAuth } from "@clerk/express";
import {
  getClerkUser,
  forgetClerkUser,
  primaryEmailOf,
  rolesOf,
  ensureAdminRoleSaved,
} from "../lib/clerkUsers.js";
import { addshow } from "./Showcontrol.js";

// ---------- role checks ----------

// Responds with whether the current user is an admin (server-validated).
// Also persists role=admin for accounts listed in ADMIN_EMAILS.
export const isAdmin = async (req, res) => {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await getClerkUser(userId);
    const roles = rolesOf(user);
    if (roles.admin) await ensureAdminRoleSaved(user);
    return res.json({ success: true, isAdmin: roles.admin, isDemo: roles.demo, isOwner: roles.owner, userId });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const isOwner = async (req, res) => {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const roles = rolesOf(await getClerkUser(userId));
    return res.json({ success: true, isOwner: roles.owner });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- owner-only admin management ----------

export const listAdmins = async (_req, res) => {
  try {
    const { data: users } = await clerkClient.users.getUserList({ limit: 200 });
    const admins = users
      .filter((u) => u?.privateMetadata?.role === "admin")
      .map((u) => ({
        id: u.id,
        email: primaryEmailOf(u),
        name: u.firstName || u.username || primaryEmailOf(u),
        demo: u?.privateMetadata?.demo === true,
      }));
    res.json({ success: true, admins });
  } catch {
    res.status(500).json({ success: false, message: "Failed to list admins" });
  }
};

async function findUserByEmail(email) {
  const { data: users } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
  return users?.[0] || null;
}

export const grantAdmin = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const u = await findUserByEmail(email);
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    const pm = { ...u.privateMetadata, role: "admin" };
    delete pm.demo; // a granted admin is a real admin
    await clerkClient.users.updateUser(u.id, { privateMetadata: pm });
    forgetClerkUser(u.id);
    res.json({ success: true, message: `Granted admin to ${email}` });
  } catch {
    res.status(500).json({ success: false, message: "Failed to grant admin" });
  }
};

export const revokeAdmin = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const u = await findUserByEmail(email);
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    const pm = { ...u.privateMetadata };
    delete pm.role;
    delete pm.demo;
    await clerkClient.users.updateUser(u.id, { privateMetadata: pm });
    forgetClerkUser(u.id);
    res.json({ success: true, message: `Revoked admin from ${email}` });
  } catch {
    res.status(500).json({ success: false, message: "Failed to revoke admin" });
  }
};

// ---------- dashboard & lists ----------

// Dashboard metrics. Active shows are summarised per movie (with the automatic
// schedule there are hundreds of individual shows).
export const adminDashboarddata = async (req, res) => {
  try {
    const now = new Date();
    const [revenueAgg, totalUsers, perMovie, activeCount] = await Promise.all([
      Booking.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, revenue: { $sum: "$amount" }, bookings: { $sum: 1 }, tickets: { $sum: { $size: "$bookedseats" } } } },
      ]),
      User.countDocuments(),
      Show.aggregate([
        { $match: { showDateTime: { $gte: now } } },
        { $sort: { showDateTime: 1 } },
        {
          $group: {
            _id: "$movie",
            showDateTime: { $first: "$showDateTime" },
            showprice: { $min: "$showprice" },
            showCount: { $sum: 1 },
          },
        },
        { $lookup: { from: "movies", localField: "_id", foreignField: "_id", as: "movie" } },
        { $unwind: "$movie" },
        {
          $project: {
            showDateTime: 1,
            showprice: 1,
            showCount: 1,
            "movie._id": 1,
            "movie.originalTitle": 1,
            "movie.primaryImage": 1,
            "movie.averageRating": 1,
          },
        },
        { $sort: { showDateTime: 1 } },
      ]),
      Show.countDocuments({ showDateTime: { $gte: now } }),
    ]);

    let activeshows = perMovie;
    if (req.isDemo) {
      const demo = await DemoShow.find({ demoOwner: req.demoUserId, showDateTime: { $gte: now } })
        .populate("movie", "originalTitle primaryImage averageRating")
        .lean();
      activeshows = [...activeshows, ...demo.map((d) => ({ ...d, showCount: 1, isDemo: true }))];
    }

    const totals = revenueAgg[0] || { revenue: 0, bookings: 0, tickets: 0 };
    res.json({
      success: true,
      dashboarddata: {
        totalUsers,
        totalRevenue: totals.revenue,
        totalBookings: totals.bookings,
        totalTickets: totals.tickets,
        activeShowCount: activeCount,
        activeshows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Return upcoming shows (real + the demo user's sandbox shows).
export const getallshows = async (req, res) => {
  try {
    const now = new Date();
    const real = await Show.find({ showDateTime: { $gte: now } })
      .select("movie showDateTime showprice occupiedSeats autoGenerated")
      .populate("movie", "originalTitle")
      .sort({ showDateTime: 1 })
      .limit(2000)
      .lean();

    let demo = [];
    if (req.isDemo) {
      demo = await DemoShow.find({ demoOwner: req.demoUserId, showDateTime: { $gte: now } })
        .populate("movie", "originalTitle")
        .sort({ showDateTime: 1 })
        .lean();
    }

    const showdata = [
      ...real.map((s) => ({ ...s, isDemo: false })),
      ...demo.map((s) => ({ ...s, isDemo: true })),
    ];
    res.json({ success: true, showdata });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Return bookings (newest first). Demo admins see anonymised customer names.
export const getbookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate("user", "name")
      .populate({ path: "show", select: "showDateTime showprice movie", populate: { path: "movie", select: "originalTitle" } })
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    const safe = req.isDemo
      ? bookings.map((b, i) => ({ ...b, user: { name: `Customer ${bookings.length - i}` } }))
      : bookings;
    res.json({ success: true, bookings: safe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- demo helpers ----------

// Unlock the sandboxed admin demo with DEMO_CODE.
// Demo admins can browse the admin panel, but anything they create is private to them
// and they never see other customers' personal details.
export const demoElevate = async (req, res) => {
  try {
    const { userId } = getAuth(req) || {};
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { code } = req.body || {};
    if (!process.env.DEMO_CODE) return res.status(503).json({ success: false, message: "Demo disabled" });
    if (String(code || "").trim() !== process.env.DEMO_CODE.trim()) {
      return res.status(403).json({ success: false, message: "Invalid demo code" });
    }

    const me = await getClerkUser(userId, { fresh: true });
    if (rolesOf(me).realAdmin) {
      return res.json({ success: true, message: "You already have full admin access." });
    }
    await clerkClient.users.updateUser(userId, {
      privateMetadata: { ...me.privateMetadata, role: "admin", demo: true },
    });
    forgetClerkUser(userId);
    return res.json({ success: true, message: "Demo admin enabled. Refresh the page." });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Kept for older frontends: real admins create public shows, demo admins create
// private sandbox shows. Same logic as /api/show/add.
export const demoCreateShow = addshow;
