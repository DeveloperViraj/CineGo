// Control/Admincontrol.js
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import { clerkClient, getAuth } from "@clerk/express";

// Helper
const primaryEmailOf = (u) =>
  u?.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress?.toLowerCase() || "";

// ---------- checks ----------
export const isAdmin = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await clerkClient.users.getUser(userId);
    const isAdmin = user?.privateMetadata?.role === "admin";
    return res.json({ success: true, isAdmin, userId });
  } catch (error) {
    console.error("isAdmin error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const isOwner = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const me = await clerkClient.users.getUser(userId);
    const email = primaryEmailOf(me);
    const owners = (process.env.OWNER_EMAIL || "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    return res.json({ success: true, isOwner: !!email && owners.includes(email) });
  } catch (e) {
    console.error("isOwner error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- owner-only admin management ----------
export const listAdmins = async (_req, res) => {
  try {
    const { data: users } = await clerkClient.users.getUserList({ limit: 200 });
    const admins = users
      .filter(u => u?.privateMetadata?.role === "admin")
      .map(u => ({ id: u.id, email: primaryEmailOf(u), name: u.firstName || u.username || primaryEmailOf(u) }));
    res.json({ success: true, admins });
  } catch (e) {
    console.error("listAdmins:", e);
    res.status(500).json({ success: false, message: "Failed to list admins" });
  }
};

export const grantAdmin = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const { data: users } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
    const u = users?.[0];
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    await clerkClient.users.updateUser(u.id, { privateMetadata: { ...u.privateMetadata, role: "admin" } });
    res.json({ success: true, message: `Granted admin to ${email}` });
  } catch (e) {
    console.error("grantAdmin:", e);
    res.status(500).json({ success: false, message: "Failed to grant admin" });
  }
};

export const revokeAdmin = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const { data: users } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
    const u = users?.[0];
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    const pm = { ...u.privateMetadata };
    delete pm.role;
    await clerkClient.users.updateUser(u.id, { privateMetadata: pm });
    res.json({ success: true, message: `Revoked admin from ${email}` });
  } catch (e) {
    console.error("revokeAdmin:", e);
    res.status(500).json({ success: false, message: "Failed to revoke admin" });
  }
};

// ---------- dashboard & lists ----------
export const adminDashboarddata = async (_req, res) => {
  try {
    const bookings = await Booking.find({ isPaid: true });
    const activeshows = await Show.find({ showDateTime: { $gte: new Date() } }).populate("movie");
    const totalUsers = await User.countDocuments();

    const dashboarddata = {
      totalUsers,
      totalRevenue: bookings.reduce((sum, b) => sum + b.amount, 0),
      totalBookings: bookings.length,
      activeshows,
    };
    res.json({ success: true, dashboarddata });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const getallshows = async (_req, res) => {
  try {
    const showdata = await Show.find({ showDateTime: { $gte: new Date() } })
      .populate("movie")
      .sort({ showDateTime: 1 });
  res.json({ success: true, showdata });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const getbookings = async (_req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate("user")
      .populate({ path: "show", populate: { path: "movie" } })
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
