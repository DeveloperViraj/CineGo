// server/Control/Stripewebhooks.js
import Stripe from "stripe";
import Booking from "../models/Booking.js";

// Optional helpers (safe to keep even if you don't have them; they are try/catch guarded)
import { inngest } from "../Inngest/index.js";           // if you have Inngest
import { sendMail } from "../lib/mailer.js";              // if you have a mailer

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

export const stripeWebhooks = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_KEY; // support old env name

  if (!whSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET missing");
    return res.status(500).json({ success: false, message: "Webhook secret missing" });
  }

  let event;
  try {
    // req.body is a Buffer because /api/stripe uses express.raw
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("⚡ Stripe webhook received:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const bookingId = session?.metadata?.bookingId;
      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, { isPaid: true, paymentLink: "" });
        console.log("✅ Booking marked paid (checkout.session.completed):", bookingId);
      } else {
        console.warn("⚠️ No bookingId on session.metadata");
      }

      // Optional email
      try {
        const to = session.customer_details?.email;
        if (to && typeof sendMail === "function") {
          await sendMail({
            to,
            subject: "🎟️ Your CineGo booking is confirmed",
            text: `Thanks for your booking! Order: ${session.id}`,
            html: `<p>Thanks for your booking!</p><p>Order: <strong>${session.id}</strong></p>`,
          });
          console.log("📨 Email sent to:", to);
        }
      } catch (e) {
        console.error("✉️ Email send failed:", e.message);
      }

      // Optional Inngest event
      try {
        if (inngest?.send) {
          await inngest.send({
            name: "app/booking.completed",
            data: {
              sessionId: session.id,
              email: session.customer_details?.email || null,
              amount_total: session.amount_total,
              currency: session.currency,
              metadata: session.metadata || {},
            },
          });
          console.log("🧩 Inngest event emitted: app/booking.completed");
        }
      } catch (e) {
        console.error("🧩 Inngest emit failed:", e.message);
      }
    }

    // Fallback for older flows that looked at payment_intent.succeeded
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
      const session = sessions.data[0];

      const bookingId = session?.metadata?.bookingId;
      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, { isPaid: true, paymentLink: "" });
        console.log("✅ Booking marked paid (payment_intent.succeeded):", bookingId);
      } else {
        console.warn("⚠️ No bookingId found via payment_intent.succeeded fallback");
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export default stripeWebhooks;
