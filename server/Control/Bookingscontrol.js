// Purpose: Handles everything related to booking seats.
// This includes: checking if seats are free, creating a booking,
// starting the Stripe payment, and returning taken seats.

import { inngest } from "../Inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { Stripe } from "stripe";
import { clerkClient, getAuth } from "@clerk/express";
import axios from "axios";

// Turn occupied seats (stored as an object or Map) into a list of seat names
function toTakenSeatArray(occ) {
  if (!occ) return [];
  if (occ instanceof Map) {
    return [...occ.entries()].filter(([, v]) => !!v).map(([k]) => k);
  }
  return Object.entries(occ).filter(([, v]) => !!v).map(([k]) => k);
}

// Check if a single seat is taken
function getSeat(occ, seat) {
  if (!occ) return false;
  return occ instanceof Map ? !!occ.get(seat) : !!occ[seat];
}

// Mark a seat as taken inside the show document
function setSeat(showDoc, seat) {
  if (showDoc.occupiedSeats instanceof Map) {
    showDoc.occupiedSeats.set(seat, true);
  } else {
    showDoc.occupiedSeats = showDoc.occupiedSeats || {};
    showDoc.occupiedSeats[seat] = true;
  }
  showDoc.markModified("occupiedSeats");
}

// Check if selected seats are still available
export const checkavailabilty = async (showId, selectedSeats) => {
  try {
    const show = await Show.findById(showId);
    if (!show) return false;

    const occ = show.occupiedSeats || new Map();
    const anyTaken = selectedSeats.some((s) => getSeat(occ, s));

    return !anyTaken;
  } catch (error) {
    console.error("checkavailability:", error);
    return false;
  }
};

// Main function: create a booking + start Stripe payment
export const createBooking = async (req, res) => {
  try {
    // Get user email from Clerk (used for Stripe receipts)
    const { userId } = getAuth(req) || {};
    let userEmail = null;

    if (userId) {
      try {
        const u = await clerkClient.users.getUser(userId);
        userEmail =
          u?.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress || null;
      } catch (e) {
        console.warn("Could not fetch Clerk user:", e.message);
      }
    }

    const { showId, selectedSeats } = req.body;
    const origin = req.headers.origin;

    if (!showId || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    // Make sure the seats aren't already booked
    const available = await checkavailabilty(showId, selectedSeats);
    if (!available) {
      return res.json({
        success: false,
        message: "Selected seats are not available",
      });
    }

    // Load the show and reserve the seats in the database
    const show = await Show.findById(showId).populate("movie");
    if (!show) return res.status(404).json({ success: false, message: "Show not found" });

    for (const seat of selectedSeats) setSeat(show, seat);
    await show.save();

    // Create a booking entry
    const booking = await Booking.create({
      user: userId || null,
      show: showId,
      amount: (show.showprice || 0) * selectedSeats.length,
      bookedseats: selectedSeats,
    });

    // Start a Stripe Checkout payment
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Convert INR → USD (simple conversion for demo)
    const conversionRate = Number(process.env.INR_TO_USD_RATE) || 86;
    const usdAmount = booking.amount / conversionRate;
    const amountInCents = Math.floor(usdAmount * 100);

    const line_items = [
      {
        price_data: {
          currency: "usd",
          product_data: { name: show.movie?.originalTitle || "Ticket" },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ];

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/loading/my-bookings`,
      cancel_url: `${origin}/my-bookings`,
      line_items,
      mode: "payment",
      customer_email: userEmail || undefined,
      payment_intent_data: userEmail ? { receipt_email: userEmail } : undefined,
      metadata: { bookingId: booking._id.toString() },
    });

    // Save Stripe payment URL
    booking.paymentLink = session.url;
    await booking.save();

    // Send background jobs (payment checks and notifications)
    await inngest.send({
      name: "app/checkpayment",
      data: { bookingId: booking._id.toString() },
    });

    await inngest.send({
      name: "app/show.booked",
      data: { bookingId: booking._id.toString() },
    });

    return res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("createBooking error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all occupied seats for a show
export const getoccupiedSeats = async (req, res) => {
  try {
    const { showId } = req.params;
    if (!showId) return res.status(400).json({ success: false, message: "ShowId required" });

    const show = await Show.findById(showId);
    if (!show) return res.status(404).json({ success: false, message: "Show not found" });

    const occupiedSeats = toTakenSeatArray(show.occupiedSeats);
    return res.json({ success: true, occupiedSeats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
