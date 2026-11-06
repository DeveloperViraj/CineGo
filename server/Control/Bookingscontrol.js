// Purpose: Handles everything related to booking seats.
// This includes: validating the request, atomically reserving seats,
// starting the Stripe payment, and returning taken seats.

import mongoose from "mongoose";
import { inngest } from "../Inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { getClerkUser, primaryEmailOf } from "../lib/clerkUsers.js";
import { frontendOrigin } from "../lib/origins.js";
import {
  getStripe,
  reserveSeats,
  freeSeats,
  seatsTakenList,
  releaseStaleHolds,
  SEAT_REGEX,
  MAX_SEATS_PER_BOOKING,
} from "../lib/bookings.js";

// Convert the INR ticket total into the Stripe charge currency.
// STRIPE_CURRENCY=inr charges rupees directly; the default keeps the original
// USD conversion (INR_TO_USD_RATE) used for the Stripe test account.
function stripeUnitAmount(inrPerSeat) {
  const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
  if (currency === "inr") return { currency, unit: Math.max(50, Math.round(inrPerSeat * 100)) };
  const rate = Number(process.env.INR_TO_USD_RATE) || 86;
  // Stripe's minimum charge is 50 cents
  return { currency, unit: Math.max(50, Math.round((inrPerSeat / rate) * 100)) };
}

// Main function: create a booking + start Stripe payment
export const createBooking = async (req, res) => {
  const userId = req.userId;
  const { showId } = req.body || {};
  const seats = Array.isArray(req.body?.selectedSeats)
    ? [...new Set(req.body.selectedSeats.map((s) => String(s).toUpperCase()))]
    : [];

  if (!mongoose.Types.ObjectId.isValid(showId) || seats.length === 0) {
    return res.status(400).json({ success: false, message: "Please select a show and at least one seat" });
  }
  if (seats.length > MAX_SEATS_PER_BOOKING) {
    return res.status(400).json({ success: false, message: `You can book up to ${MAX_SEATS_PER_BOOKING} seats at a time` });
  }
  if (!seats.every((s) => SEAT_REGEX.test(s))) {
    return res.status(400).json({ success: false, message: "Invalid seat selection" });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ success: false, message: "Payments are not configured" });
  }

  const show = await Show.findById(showId).populate("movie", "originalTitle primaryImage").lean();
  if (!show) return res.status(404).json({ success: false, message: "Show not found" });
  if (new Date(show.showDateTime).getTime() < Date.now() - 5 * 60 * 1000) {
    return res.status(400).json({ success: false, message: "This show has already started" });
  }

  // Free seats from holds that expired without the background job running
  await releaseStaleHolds({ show: show._id }).catch(() => {});

  const reserved = await reserveSeats(showId, seats);
  if (!reserved) {
    return res.status(409).json({
      success: false,
      message: "Some of those seats were just taken. Please pick different seats.",
    });
  }

  let booking = null;
  try {
    let userEmail;
    try {
      userEmail = primaryEmailOf(await getClerkUser(userId)) || undefined;
    } catch (e) {
      console.warn("Could not fetch Clerk user:", e.message);
    }

    booking = await Booking.create({
      user: userId,
      show: showId,
      amount: (show.showprice || 0) * seats.length,
      bookedseats: seats,
    });

    const { currency, unit } = stripeUnitAmount(show.showprice || 0);
    const origin = frontendOrigin(req);

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/loading/my-bookings`,
      cancel_url: `${origin}/my-bookings`,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: show.movie?.originalTitle || "Movie ticket",
              description: `Seats ${seats.join(", ")}`,
              ...(show.movie?.primaryImage?.startsWith("https://") ? { images: [show.movie.primaryImage] } : {}),
            },
            unit_amount: unit,
          },
          quantity: seats.length,
        },
      ],
      customer_email: userEmail,
      payment_intent_data: userEmail ? { receipt_email: userEmail } : undefined,
      metadata: { bookingId: booking._id.toString() },
      // Stripe's minimum lifetime is 30 minutes; the seat-hold job expires it sooner
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });

    booking.paymentLink = session.url;
    booking.stripeSessionId = session.id;
    await booking.save();

    // Release the seats if payment doesn't arrive in time.
    // A failure here must not break the booking — the webhook/expiry is the fallback.
    inngest
      .send({ name: "app/checkpayment", data: { bookingId: booking._id.toString() } })
      .catch((e) => console.warn("Inngest checkpayment send failed:", e.message));

    return res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("createBooking error:", error);
    // Roll back the seat hold so the seats don't stay locked forever
    await freeSeats(showId, seats).catch(() => {});
    if (booking) await Booking.deleteOne({ _id: booking._id }).catch(() => {});
    return res.status(500).json({ success: false, message: "Could not start payment. Please try again." });
  }
};

// Get all occupied seats for a show
export const getoccupiedSeats = async (req, res) => {
  try {
    const { showId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(showId)) {
      return res.status(400).json({ success: false, message: "Invalid show" });
    }

    await releaseStaleHolds({ show: showId }).catch(() => {});

    const show = await Show.findById(showId).select("occupiedSeats").lean();
    if (!show) return res.status(404).json({ success: false, message: "Show not found" });

    res.set("Cache-Control", "no-store");
    return res.json({ success: true, occupiedSeats: seatsTakenList(show.occupiedSeats) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
