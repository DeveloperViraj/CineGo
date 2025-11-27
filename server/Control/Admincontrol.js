import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import { clerkClient, getAuth } from "@clerk/express";
import DemoShow from "../models/DemoShow.js";
import Movie from "../models/Movie.js";
import axios from "axios";

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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
    res.status(500).json({ success: false, message: "Failed to revoke admin" });
  }
};

// ---------- dashboard & lists ----------
export const adminDashboarddata = async (req, res) => {
  try {
    const bookings = await Booking.find({ isPaid: true });
    let activeshows = await Show.find({ showDateTime: { $gte: new Date() } }).populate("movie");

    if (req.isDemo) {
      const demo = await DemoShow.find({
        demoOwner: req.demoUserId,
        showDateTime: { $gte: new Date() },
      }).populate("movie");
      activeshows = [...activeshows, ...demo];
    }

    const dashboarddata = {
      totalUsers: await User.countDocuments(),
      totalRevenue: bookings.reduce((sum, b) => sum + b.amount, 0),
      totalBookings: bookings.length,
      activeshows,
    };
    res.json({ success: true, dashboarddata });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const getallshows = async (req, res) => {
  try {
    const real = await Show.find({ showDateTime: { $gte: new Date() } })
      .populate("movie")
      .sort({ showDateTime: 1 })
      .lean();

    let demo = [];
    if (req.isDemo) {
      demo = await DemoShow.find({
        demoOwner: req.demoUserId,
        showDateTime: { $gte: new Date() },
      }).populate("movie").sort({ showDateTime: 1 }).lean();
    }

    const showdata = [
      ...real.map(s => ({ ...s, isDemo: false })),
      ...demo.map(s => ({ ...s, isDemo: true })),
    ];

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

// ---------- demo helpers ----------
export const demoElevate = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { code } = req.body || {};
    if (!process.env.DEMO_CODE) return res.status(503).json({ success: false, message: "Demo disabled" });
    if (code !== process.env.DEMO_CODE) return res.status(403).json({ success: false, message: "Invalid demo code" });

    const me = await clerkClient.users.getUser(userId);
    await clerkClient.users.updateUser(userId, {
      privateMetadata: { ...me.privateMetadata, role: "admin", demo: true },
    });
    return res.json({ success: true, message: "Demo admin enabled. Refresh the page." });
  } catch {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Fixed version
export const demoCreateShow = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { movieId, showsInput = [], showprice } = req.body || {};
    if (!movieId || !Array.isArray(showsInput) || showsInput.length === 0 || !showprice) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    const me = await clerkClient.users.getUser(userId);
    const isAdmin = me?.privateMetadata?.role === "admin";
    const isDemoUsr = req.isDemo === true || me?.privateMetadata?.demo === true;

    // ✅ Find or create Movie by tmdbId
    let movie = await Movie.findOne({ tmdbId: String(movieId) });
    if (!movie) {
      const { data: m } = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
        headers: { Authorization: `Bearer ${process.env.TMDB_KEY}` },
      });

      const { data: credits } = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
        headers: { Authorization: `Bearer ${process.env.TMDB_KEY}` },
      });
      const casts = (credits.cast ?? []).slice(0, 12).map(c => ({
        fullName: c.name,
        primaryImage: c.profile_path ? `https://image.tmdb.org/t/p/w500${c.profile_path}` : null,
      }));

      movie = await Movie.create({
        tmdbId: String(m.id),
        originalTitle: m.original_title || m.title || "Untitled",
        description: m.overview || "",
        primaryImage: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
        thumbnails: m.backdrop_path ? [`https://image.tmdb.org/t/p/w500${m.backdrop_path}`] : [],
        releaseDate: m.release_date || "",
        original_language: [m.original_language].filter(Boolean),
        genres: (m.genres || []).map(g => g.name),
        casts,
        averageRating: m.vote_average ?? null,
        runtime: m.runtime ?? null,
        numVotes: m.vote_count ?? null,
      });
    }

    const docs = showsInput.map(({ date, time }) => ({
      movie: movie._id,
      showDateTime: new Date(`${date}T${time}`),
      showprice: Number(showprice),
      occupiedSeats: {},
      ...(isDemoUsr ? { isDemo: true, demoOwner: userId } : {}),
    }));

    if (isAdmin) {
      const created = await Show.insertMany(docs);
      return res.json({ success: true, mode: "public", count: created.length, shows: created });
    }
    if (isDemoUsr) {
      const created = await DemoShow.insertMany(docs);
      return res.json({ success: true, mode: "demo", count: created.length, shows: created });
    }

    return res.status(403).json({ success: false, message: "Not allowed" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || "Failed to create show" });
  }
};
