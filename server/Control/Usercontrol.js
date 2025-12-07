// Purpose: User-specific endpoints (fetch user bookings, manage favorites).
// These handlers read the authenticated user from Clerk, then perform DB or Clerk operations.
// Keep responses uniform: { success: true/false, ... } so frontend can handle them easily.

import { clerkClient, getAuth } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";

// Return bookings for the currently authenticated user.
// The booking documents include populated show -> movie for easy frontend rendering.
export const getUserbookings = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const bookings = await Booking.find({ user: userId })
      .populate({ path: "show", populate: { path: "movie" } })
      .sort({ createdAt: -1 });
    return res.json({ success: true, bookings });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Toggle a movie in the user's favorites list (stored in Clerk privateMetadata).
// If movieId exists -> remove it; otherwise add it.
// We read the user's current metadata, update the favorites array, and write it back to Clerk.
export const updateUserfavorites = async (req, res) => {
  try {
    const { movieId } = req.body;
    const { userId } = getAuth(req);

    const user = await clerkClient.users.getUser(userId);
    const existing = user.privateMetadata?.favorites || [];

    const updated = existing.includes(movieId)
      ? existing.filter((id) => id !== movieId)
      : [...existing, movieId];

    await clerkClient.users.updateUser(userId, {
      privateMetadata: { ...user.privateMetadata, favorites: updated },
    });

    return res.json({ success: true, message: "Favorites updated successfully" });
  } catch (error) {
    console.error("updateUserfavorites:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server Error" });
  }
};

// Return the user's favorite movies (reads favorite IDs from Clerk and fetches Movie docs).
export const getfavorites = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const user = await clerkClient.users.getUser(userId);
    const favorites = user.privateMetadata?.favorites || [];
    const movies = await Movie.find({ _id: { $in: favorites } });
    return res.json({ success: true, movies });
  } catch (error) {
    console.error("getfavorites:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
