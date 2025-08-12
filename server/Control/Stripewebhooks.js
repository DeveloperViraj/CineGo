import Stripe from 'stripe';
import Booking from '../models/Booking.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhooks = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_KEY);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent.id });
    const session = sessions.data[0];
    const bookingId = session?.metadata?.bookingId;

    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, { isPaid: true, paymentLink: '' });
      console.log('✅ Payment successful. Booking updated for:', bookingId);
    }
  }

  res.sendStatus(200);
};
