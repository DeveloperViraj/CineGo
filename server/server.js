// server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import mongoConnect from './config/database.js';
import { clerkMiddleware, clerkClient, getAuth } from '@clerk/express';
import { serve } from 'inngest/express';
import { inngest, functions } from './Inngest/index.js';
import showRouter from './Routes/showrouter.js';
import bookingRouter from './Routes/bookingrouter.js';
import adminRouter from './Routes/adminrouter.js';
import userRouter from './Routes/userrouter.js';
import { stripeWebhooks } from './Control/Stripewebhooks.js';
import { attachDemoFlag } from './Middleware/Demo.js';
import sendEmail from "./config/nodemailer.js";

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB before starting the server
await mongoConnect();

// Stripe webhook endpoint (requires raw body for signature verification)
app.post(
  '/api/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhooks
);

// Apply JSON parser for all routes except Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/stripe')) {
    return next();
  }
  return express.json()(req, res, next);
});

// Configure CORS to allow only trusted frontend origins
const allowed = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5176',
    'https://cinego-chi.vercel.app',
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowed.has(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Attach Clerk authentication middleware
app.use(clerkMiddleware());

// Attach demo flag middleware (optional - used for demo/testing purposes)
app.use(attachDemoFlag);

// Auto-promote admin users based on email
// This is optional — the app works without it, but I kept it to simplify admin setup during deployment
app.use(async (req, _res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return next();

    const user = await clerkClient.users.getUser(userId);
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const primaryEmail = user?.emailAddresses?.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress?.toLowerCase();

    if (
      primaryEmail &&
      adminEmails.includes(primaryEmail) &&
      user.privateMetadata?.role !== 'admin'
    ) {
      await clerkClient.users.updateUser(userId, {
        privateMetadata: { ...user.privateMetadata, role: 'admin' },
      });
    }
  } catch (err) {
    console.error('Auto-promote admin error:', err.message);
  }
  next();
});

// Health check endpoint (used by hosting platforms to check server status)
app.get('/', (_req, res) => res.send('Server is live!'));

// Developer-only route for testing SMTP configuration
// Not required for core app functionality, but useful during setup/debugging
app.get("/api/dev/test-email", async (_req, res) => {
  try {
    const to = process.env.TEST_EMAIL_TO || "you@example.com";
    await sendEmail({
      to,
      subject: "CineGo test email",
      body: "<p>If you see this, SMTP works.</p>",
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, err: e.message });
  }
});

// Inngest endpoint for handling background jobs
// Optional — the app can run without it, but I added it for asynchronous tasks
app.use('/api/inngest', serve({ client: inngest, functions }));

// Register main API routes
app.use('/api/show', showRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || 'Server error' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

export default app;
