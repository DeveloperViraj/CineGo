// Purpose: Shared seat-hold logic used by the booking API, the Stripe webhook
// and the Inngest background job.
//
// A booking holds seats for SEAT_HOLD_MINUTES (default 10). If it isn't paid by then:
//   - the Stripe Checkout session is expired (so the user can't pay for seats
//     that were given to someone else), and
//   - the seats are released and the unpaid booking is deleted.
// If the background job never runs, Stripe expires the session itself after
// 30 minutes and the `checkout.session.expired` webhook does the same cleanup.

import Stripe from "stripe";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

let stripeClient = null;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export const SEAT_HOLD_MINUTES = Math.max(5, parseInt(process.env.SEAT_HOLD_MINUTES, 10) || 10);

// Seat layout used by the frontend: rows A–L, seats 1–9
export const SEAT_REGEX = /^[A-L][1-9]$/;
export const MAX_SEATS_PER_BOOKING = 5;

const seatPath = (seat) => `occupiedSeats.${seat}`;

export function seatsTakenList(occ) {
  if (!occ) return [];
  const entries = occ instanceof Map ? [...occ.entries()] : Object.entries(occ);
  return entries.filter(([, v]) => !!v).map(([k]) => k);
}

// Atomically reserve seats. Returns the updated show, or null if any seat was already taken.
// (The old code read the show, checked the seats, then saved — two people could
// book the same seat at the same moment.)
export function reserveSeats(showId, seats) {
  const free = Object.fromEntries(seats.map((s) => [seatPath(s), { $in: [null, false] }]));
  const take = Object.fromEntries(seats.map((s) => [seatPath(s), true]));
  return Show.findOneAndUpdate({ _id: showId, ...free }, { $set: take }, { new: true });
}

export function freeSeats(showId, seats) {
  if (!seats?.length) return Promise.resolve();
  const unset = Object.fromEntries(seats.map((s) => [seatPath(s), ""]));
  return Show.updateOne({ _id: showId }, { $unset: unset });
}

// Release an unpaid booking. Safe to call more than once and from several places.
export async function releaseUnpaidBooking(bookingId, { expireSession = true } = {}) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking || booking.isPaid) return false;

  const stripe = getStripe();
  if (expireSession && stripe && booking.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
      // Paid at the last second: leave it to the webhook to mark it paid
      if (session.status === "complete" || session.payment_status === "paid") return false;
      if (session.status === "open") await stripe.checkout.sessions.expire(booking.stripeSessionId);
    } catch (err) {
      console.warn("releaseUnpaidBooking: could not expire Stripe session:", err.message);
    }
  }

  // Only delete if it is STILL unpaid (the webhook may have raced us)
  const deleted = await Booking.findOneAndDelete({ _id: bookingId, isPaid: false }).lean();
  if (!deleted) return false;
  await freeSeats(deleted.show, deleted.bookedseats);
  return true;
}

// Safety net: release holds that outlived the seat-hold window + Stripe's own expiry.
export async function releaseStaleHolds(filter = {}) {
  const cutoff = new Date(Date.now() - (SEAT_HOLD_MINUTES + 35) * 60 * 1000);
  const stale = await Booking.find({ ...filter, isPaid: false, createdAt: { $lt: cutoff } })
    .select("_id")
    .limit(200)
    .lean();
  let released = 0;
  for (const b of stale) {
    if (await releaseUnpaidBooking(b._id)) released++;
  }
  return released;
}
