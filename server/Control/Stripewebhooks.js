// Purpose: Handle Stripe webhook events for payments.
// This file verifies Stripe signatures, processes successful payments,
// marks bookings as paid, sends confirmation emails, and optionally emits background events.
// Note: I did not change any logic , only added simple comments to explain intent.
// Keep the existing webhook secret and Stripe configuration in env variables.

import Stripe from "stripe";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import Movie from "../models/Movie.js";
import User from "../models/User.js";

// Use the SAME mailer you use elsewhere in the app:
import sendEmail from "../config/nodemailer.js"; 

// Optional: still emit to Inngest if you want
import { inngest } from "../Inngest/index.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

// Main webhook handler exported to /api/stripe route
// - Verifies signature using the raw request body (route must use express.raw())
// - Processes checkout.session.completed and payment_intent.succeeded events
// - Marks the related booking as paid and sends a confirmation email
export const stripeWebhooks = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const whSecret =
    process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_KEY;

  if (!whSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET missing");
    return res
      .status(500)
      .json({ success: false, message: "Webhook secret missing" });
  }

  let event;
  try {
    // req.body is a Buffer because /api/stripe route uses express.raw
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("⚡ Stripe webhook received:", event.type);

  try {
    // Helper: finalize booking and send email
    // Steps:
    // 1. Read bookingId from session metadata
    // 2. Mark booking.isPaid = true and clear paymentLink
    // 3. Enrich email content with booking/show/movie details if possible
    // 4. Send email via configured mailer (sendEmail)
    // 5. Optionally emit an Inngest event for further processing
    const markPaidAndEmail = async (session) => {
      const bookingId = session?.metadata?.bookingId;
      const to =
        session?.customer_details?.email ||
        session?.customer_email ||
        null;

      if (!bookingId) {
        console.warn("⚠️ No bookingId on session.metadata");
        return;
      }

      // Mark booking paid
      await Booking.findByIdAndUpdate(bookingId, {
        isPaid: true,
        paymentLink: "",
      });
      console.log("✅ Booking marked paid:", bookingId);

      // Try to gather booking/show/movie details for the email body
      let movieTitle = "your movie";
      let seatList = "";
      let showDate = "";
      let showTime = "";
      try {
        const booking = await Booking.findById(bookingId).populate({
          path: "show",
          populate: { path: "movie", model: "Movie" },
        });
        if (booking?.show?.movie) {
          movieTitle = booking.show.movie.originalTitle || movieTitle;
        }
        if (Array.isArray(booking?.bookedseats)) {
          seatList = booking.bookedseats.join(", ");
        }
        if (booking?.show?.showDateTime) {
          const dt = new Date(booking.show.showDateTime);
          showDate = dt.toLocaleDateString("en-US", {
            timeZone: "Asia/Kolkata",
          });
          showTime = dt.toLocaleTimeString("en-US", {
            timeZone: "Asia/Kolkata",
          });
        }
      } catch (e) {
        console.warn("ℹ️ Could not enrich email with booking details:", e.message);
      }

      // Send confirmation email (if we have an email address)
      try {
        if (to) {
          await sendEmail({
            to,
            subject: `Payment confirmation: '${movieTitle}' booked!`,
            body: `
              <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <div style="background-color:#7b2cbf;color:white;padding:20px;text-align:center;">
                  <h1 style="margin:0;">🎟️ CineGo Booking Confirmed!</h1>
                </div>
                <div style="padding:24px;font-size:16px;color:#333;">
                  <p>Your booking for <strong style="color:#7b2cbf;">"${movieTitle}"</strong> is confirmed.</p>
                  ${showDate || showTime ? `<p><strong>Date:</strong> ${showDate}<br><strong>Time:</strong> ${showTime}</p>` : ""}
                  <p><strong>Booking ID:</strong> <span style="color:#7b2cbf;">${bookingId}</span></p>
                  ${seatList ? `<p><strong>Seats:</strong> ${seatList}</p>` : ""}
                  <p>🎬 Enjoy the show and don’t forget to grab your popcorn!</p>
                </div>
                <div style="background-color:#f5f5f5;color:#777;padding:16px;text-align:center;font-size:14px;">
                  <p style="margin:0;">Thanks for booking with us!<br>— The CineGo Team</p>
                </div>
              </div>`,
          });
          console.log("📨 Email sent to:", to);
        } else {
          console.warn("⚠️ No email on session; skipping mail send.");
        }
      } catch (e) {
        console.error("✉️ Email send failed:", e.message);
      }

      // Optionally emit an Inngest event so other workers can react
      try {
        if (inngest?.send) {
          await inngest.send({
            name: "app/show.booked",
            data: { bookingId },
          });
          console.log("🧩 Inngest event emitted: app/show.booked", bookingId);
        }
      } catch (e) {
        console.error("🧩 Inngest emit failed:", e.message);
      }
    };

    // When checkout completes, finalize booking and email user
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await markPaidAndEmail(session);
    }

    // Older flow: listen for payment intent success and find session
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: pi.id,
        limit: 1,
      });
      const session = sessions.data[0];
      if (!session) {
        console.warn("⚠️ No session found for payment_intent:", pi.id);
      } else {
        await markPaidAndEmail(session);
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler failed:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

export default stripeWebhooks;
