// Purpose: Handle Stripe webhook events for payments.
// - Verifies the signature using the raw body (route uses express.raw()).
// - checkout.session.completed / async_payment_succeeded / payment_intent.succeeded:
//     mark the booking paid and send ONE confirmation email.
//     The update is idempotent (isPaid:false -> true), so Stripe retries or receiving
//     several of these events for the same payment never sends duplicate emails.
// - checkout.session.expired: release the held seats and remove the unpaid booking.

import Booking from "../models/Booking.js";
import User from "../models/User.js";
import sendEmail from "../config/nodemailer.js";
import { bookingConfirmationEmail } from "../lib/emails.js";
import { getStripe, releaseUnpaidBooking } from "../lib/bookings.js";
import { invalidate } from "../lib/cache.js";

async function markPaidAndEmail(session) {
  const bookingId = session?.metadata?.bookingId;
  if (!bookingId) {
    console.warn("⚠️ No bookingId on session.metadata");
    return;
  }

  // Only the first event that flips isPaid continues (prevents duplicate emails)
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, isPaid: false },
    { $set: { isPaid: true, paymentLink: "" } },
    { new: true }
  ).populate({ path: "show", populate: { path: "movie", model: "Movie" } });

  if (!booking) {
    const exists = await Booking.exists({ _id: bookingId });
    if (!exists) {
      // Paid after the hold was released. Log loudly so it can be refunded from the Stripe dashboard.
      console.error(`❌ Payment received for released booking ${bookingId} (session ${session.id}). Refund needed.`);
    }
    return;
  }
  console.log("✅ Booking marked paid:", bookingId);
  invalidate("public:");

  const user = await User.findById(booking.user).lean().catch(() => null);
  const to = session?.customer_details?.email || session?.customer_email || user?.email || null;
  if (!to) {
    console.warn("⚠️ No email on session; skipping mail send.");
    return;
  }

  try {
    const { subject, body } = bookingConfirmationEmail({
      name: user?.name,
      movie: booking.show?.movie,
      showDateTime: booking.show?.showDateTime,
      bookingId: booking._id,
      seats: booking.bookedseats,
      amount: booking.amount,
    });
    await sendEmail({ to, subject, body });
    console.log("📨 Confirmation email sent to:", to);
  } catch (e) {
    console.error("✉️ Email send failed:", e.message);
  }
}

export const stripeWebhooks = async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_KEY;

  if (!stripe || !whSecret) {
    console.error("❌ Stripe secret key or webhook secret missing");
    return res.status(500).json({ success: false, message: "Webhook not configured" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        // For delayed payment methods "completed" can arrive before the money does
        if (session.payment_status === "paid") await markPaidAndEmail(session);
        break;
      }
      case "payment_intent.succeeded": {
        // Kept for dashboards that only subscribe to this event
        const pi = event.data.object;
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        if (sessions.data[0]) await markPaidAndEmail(sessions.data[0]);
        break;
      }
      case "checkout.session.expired": {
        const bookingId = event.data.object?.metadata?.bookingId;
        if (bookingId) await releaseUnpaidBooking(bookingId, { expireSession: false });
        break;
      }
      default:
        break;
    }
    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler failed:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export default stripeWebhooks;
