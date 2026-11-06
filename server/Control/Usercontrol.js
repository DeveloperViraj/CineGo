// Purpose: User-specific endpoints (fetch user bookings, manage favorites).
// Keep responses uniform: { success: true/false, ... } so frontend can handle them easily.

import mongoose from "mongoose";
import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";
import { getClerkUser, forgetClerkUser } from "../lib/clerkUsers.js";

const CARD_FIELDS =
  "originalTitle primaryImage backdrop releaseDate genres runtime averageRating description tmdbId";

// Return bookings for the currently authenticated user (newest first).
export const getUserbookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.userId })
      .populate({
        path: "show",
        select: "showDateTime showprice movie",
        populate: { path: "movie", select: CARD_FIELDS },
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle a movie in the user's favorites list (stored in Clerk privateMetadata).
export const updateUserfavorites = async (req, res) => {
  try {
    const movieId = String(req.body?.movieId || "");
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({ success: false, message: "Invalid movie" });
    }

    const user = await getClerkUser(req.userId, { fresh: true });
    const existing = user.privateMetadata?.favorites || [];
    const added = !existing.includes(movieId);
    const updated = added ? [...existing, movieId] : existing.filter((id) => id !== movieId);

    await clerkClient.users.updateUser(req.userId, {
      privateMetadata: { ...user.privateMetadata, favorites: updated },
    });
    forgetClerkUser(req.userId);

    return res.json({
      success: true,
      added,
      favorites: updated,
      message: added ? "Added to favourites" : "Removed from favourites",
    });
  } catch (error) {
    console.error("updateUserfavorites:", error);
    return res.status(500).json({ success: false, message: error.message || "Server Error" });
  }
};

// Return the user's favorite movies.
export const getfavorites = async (req, res) => {
  try {
    const user = await getClerkUser(req.userId);
    const favorites = (user.privateMetadata?.favorites || []).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    const movies = await Movie.find({ _id: { $in: favorites } }).select(CARD_FIELDS).lean();
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, movies });
  } catch (error) {
    console.error("getfavorites:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
