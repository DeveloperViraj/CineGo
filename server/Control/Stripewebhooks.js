// server/Control/Stripewebhooks.js
import Stripe from "stripe";
import Booking from "../models/Booking.js";
import { inngest } from "../Inngest/index.js";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Stripe webhook handler
 * NOTE: In server.js the route must be:
 *   app.post('/api/stripe', express.raw({ type: 'application/json' }), stripeWebhooks)
 * so that req.body is the raw Buffer for signature verification.
 */
export const stripeWebhooks = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_KEY;

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET missing");
    return res.status(500).json({ success: false, message: "Webhook secret missing" });
  }

  let event;
  try {
    // Verify the webhook signature against the raw body buffer
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`⚡ Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      /**
       * Preferred event for Checkout payments
       */
      case "checkout.session.completed": {
        const session = event.data.object;

        // Try to get bookingId from multiple places
        const bookingId =
          session?.metadata?.bookingId ||
          session?.client_reference_id ||
          null;

        if (!bookingId) {
          console.warn("⚠️ checkout.session.completed without bookingId");
          break;
        }

        await Booking.findByIdAndUpdate(bookingId, {
          isPaid: true,
          paymentLink: "",
        });

        console.log("✅ Booking marked paid (checkout.session.completed):", bookingId);

        // Trigger your existing Inngest email flow
        try {
          await inngest.send({
            name: "app/show.booked",
            data: { bookingId },
          });
          console.log("📨 Inngest event sent: app/show.booked", bookingId);
        } catch (e) {
          console.error("🧩 Inngest emit failed:", e.message);
        }

        break;
      }

      /**
       * Fallback for some flows using Payment Intents directly
       */
      case "payment_intent.succeeded": {
        const pi = event.data.object;

        // 1) Try PI metadata
        let bookingId = pi?.metadata?.bookingId || null;

        // 2) Else look up the Checkout Session tied to this PI
        if (!bookingId) {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: pi.id,
            limit: 1,
          });
          const session = sessions.data[0];
          bookingId =
            session?.metadata?.bookingId ||
            session?.client_reference_id ||
            null;
        }

        if (!bookingId) {
          console.warn("⚠️ payment_intent.succeeded without resolvable bookingId");
          break;
        }

        await Booking.findByIdAndUpdate(bookingId, {
          isPaid: true,
          paymentLink: "",
        });

        console.log("✅ Booking marked paid (payment_intent.succeeded):", bookingId);

        // Trigger your existing Inngest email flow
        try {
          await inngest.send({
            name: "app/show.booked",
            data: { bookingId },
          });
          console.log("📨 Inngest event sent: app/show.booked", bookingId);
        } catch (e) {
          console.error("🧩 Inngest emit failed:", e.message);
        }

        break;
      }

      default:
        // Ignore other events cleanly
        break;
    }

    // Always 200 so Stripe doesn't retry unnecessarily
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    // Still return 200 to prevent repeated retries; switch to 500 during active debugging if you prefer
    return res.sendStatus(200);
  }
};
