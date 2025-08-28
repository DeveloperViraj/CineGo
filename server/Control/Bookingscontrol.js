// server/Control/Bookingscontrol.js
import { inngest } from "../Inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import { Stripe } from "stripe";

/** Normalize occupiedSeats to an array of taken seat ids */
function toTakenSeatArray(occ) {
  if (!occ) return [];
  if (occ instanceof Map) {
    return [...occ.entries()].filter(([, v]) => !!v).map(([k]) => k);
  }
  // plain object fallback
  return Object.entries(occ).filter(([, v]) => !!v).map(([k]) => k);
}

/** Read a single seat's taken flag from Map or object */
function getSeat(occ, seat) {
  if (!occ) return false;
  return occ instanceof Map ? !!occ.get(seat) : !!occ[seat];
}

/** Set a seat taken in Map or object */
function setSeat(showDoc, seat) {
  if (showDoc.occupiedSeats instanceof Map) {
    showDoc.occupiedSeats.set(seat, true);
  } else {
    showDoc.occupiedSeats = showDoc.occupiedSeats || {};
    showDoc.occupiedSeats[seat] = true;
  }
  // ensure Mongoose persists changes when it's an object
  showDoc.markModified("occupiedSeats");
}

// ---------------- Availability ----------------
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

// ---------------- Booking ----------------
export const createBooking = async (req, res) => {
  try {
    const { userId } = req.auth(); // if your project uses getAuth(req), swap to that
    const { showId, selectedSeats } = req.body;
    const origin = req.headers.origin;

    const isAvailable = await checkavailabilty(showId, selectedSeats);
    if (!isAvailable) {
      return res.json({ success: false, message: "Selected seats are not available" });
    }

    const show = await Show.findById(showId).populate("movie");

    // Mark seats as occupied (works for Map or object)
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
    const conversionRate = 86; // your existing conversion
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
      metadata: { bookingId: booking._id.toString() },
    });

    booking.paymentLink = session.url;
    await booking.save();

    await inngest.send({
      name: "app/checkpayment",
      data: { bookingId: booking._id.toString() },
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe session error:", error);
    res.json({ success: false, message: error.message });
  }
};

// ---------------- Occupied seats for UI ----------------
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
