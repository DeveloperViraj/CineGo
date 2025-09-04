// server/Control/Bookingscontrol.js
import { inngest } from "../Inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { Stripe } from "stripe";
import { clerkClient, getAuth } from "@clerk/express";

function toTakenSeatArray(occ) {
  if (!occ) return [];
  if (occ instanceof Map) {
    return [...occ.entries()].filter(([, v]) => !!v).map(([k]) => k);
  }
  return Object.entries(occ).filter(([, v]) => !!v).map(([k]) => k);
}

function getSeat(occ, seat) {
  if (!occ) return false;
  return occ instanceof Map ? !!occ.get(seat) : !!occ[seat];
}

function setSeat(showDoc, seat) {
  if (showDoc.occupiedSeats instanceof Map) {
    showDoc.occupiedSeats.set(seat, true);
  } else {
    showDoc.occupiedSeats = showDoc.occupiedSeats || {};
    showDoc.occupiedSeats[seat] = true;
  }
  showDoc.markModified("occupiedSeats");
}

export const checkavailabilty = async (showId, selectedSeats) => {
  try {
    const show = await Show.findById(showId);
    if (!show) return false;
    const occ = show.occupiedSeats || new Map();
    const seatTaken = selectedSeats.some((s) => getSeat(occ, s));
    return !seatTaken;
  } catch (error) {
    console.error("checkavailabilty:", error);
    return false;
  }
};

export const createBooking = async (req, res) => {
  try {
    // Get userId and email (Clerk)
    const { userId } = getAuth(req) || {};
    let userEmail = null;
    if (userId) {
      try {
        const u = await clerkClient.users.getUser(userId);
        userEmail =
          u?.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress || null;
      } catch (e) {
        console.warn("⚠️ Could not fetch Clerk user:", e.message);
      }
    }

    const { showId, selectedSeats } = req.body;
    const origin = req.headers.origin;

    const isAvailable = await checkavailabilty(showId, selectedSeats);
    if (!isAvailable) {
      return res.json({ success: false, message: "Selected seats are not available" });
    }

    const show = await Show.findById(showId).populate("movie");

    // Mark seats as occupied
    for (const seat of selectedSeats) setSeat(show, seat);
    await show.save();

    const booking = await Booking.create({
      user: userId,
      show: showId,
      amount: show.showprice * selectedSeats.length,
      bookedseats: selectedSeats,
    });

    // Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const conversionRate = 86; // INR→USD
    const usdAmount = booking.amount / conversionRate;
    const unitAmountInCents = Math.floor(usdAmount * 100);

    const line_items = [
      {
        price_data: {
          currency: "usd",
          product_data: { name: show.movie.originalTitle },
          unit_amount: unitAmountInCents,
        },
        quantity: 1,
      },
    ];

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/loading/my-bookings`,
      cancel_url: `${origin}/my-bookings`,
      line_items,
      mode: "payment",
      // ✅ These two lines ensure your webhook has an email to send to
      customer_email: userEmail || undefined,
      payment_intent_data: userEmail ? { receipt_email: userEmail } : undefined,
      // Keep booking reference for webhook
      metadata: { bookingId: booking._id.toString() },
    });

    booking.paymentLink = session.url;
    await booking.save();

    // schedule payment check + initial notification
    await inngest.send({
      name: "app/checkpayment",
      data: { bookingId: booking._id.toString() },
    });

    await inngest.send({
      name: "app/show.booked",
      data: { bookingId: booking._id.toString() },
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe session error:", error);
    res.json({ success: false, message: error.message });
  }
};

export const getoccupiedSeats = async (req, res) => {
  try {
    const { showId } = req.params;
    const show = await Show.findById(showId);
    if (!show) return res.json({ success: false, message: "Show not found" });

    const occupiedSeats = toTakenSeatArray(show.occupiedSeats);
    res.json({ success: true, occupiedSeats });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
