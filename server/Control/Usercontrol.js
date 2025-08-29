// Control/Usercontrol.js
import { clerkClient, getAuth } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";

export const getUserbookings = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const bookings = await Booking.find({ user: userId })
      .populate({ path: 'show', populate: { path: 'movie' } })
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const updateUserfavorites = async (req, res) => {
  try {
    const { movieId } = req.body;
    const { userId } = getAuth(req);

    const user = await clerkClient.users.getUser(userId);
    const existing = user.privateMetadata?.favorites || [];

    const updated = existing.includes(movieId)
      ? existing.filter(id => id !== movieId)
      : [...existing, movieId];

    await clerkClient.users.updateUser(userId, {
      privateMetadata: { ...user.privateMetadata, favorites: updated },
    });

    res.json({ success: true, message: 'Favorites updated successfully' });
  } catch (error) {
    console.error('updateUserfavorites:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

export const getfavorites = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const user = await clerkClient.users.getUser(userId);
    const favorites = user.privateMetadata?.favorites || [];
    const movies = await Movie.find({ _id: { $in: favorites } });
    res.json({ success: true, movies });
  } catch (error) {
    console.error("getfavorites:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
