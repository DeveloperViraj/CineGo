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

// Establish MongoDB connection before accepting any requests.
// The server should not start if the database is unavailable.
await mongoConnect();

// Stripe webhook endpoint.
// Stripe requires the raw request body to verify webhook signatures,
// so JSON parsing is intentionally skipped for this route.
app.post(
  '/api/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhooks
);

// Apply JSON body parsing for all routes except Stripe webhooks.
// Parsing Stripe payloads would break signature verification.
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/stripe')) {
    return next();
  }
  return express.json()(req, res, next);
});

// Restrict API access to known frontend origins only.
// This protects the backend from unauthorized browser requests.
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

// Attach Clerk authentication middleware.
// This enables access to user identity and session data on every request.
app.use(clerkMiddleware());

// Attach demo-related flags to the request.
// This enables controlled demo behavior without affecting production users.
app.use(attachDemoFlag);

// Automatically assign admin role based on email.
// This is optional and exists to simplify admin onboarding during deployment.
// The application functions correctly even if this middleware is removed.
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

// Health check endpoint.
// Used by hosting providers and load balancers to confirm server availability.
app.get('/', (_req, res) => res.send('Server is live!'));

// Development-only route for verifying SMTP configuration.
// This is not required for production and can be safely removed.
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

// Inngest endpoint for background and scheduled jobs.
// The core application works without this, but it enables async workflows
// such as delayed seat release and email notifications.
app.use('/api/inngest', serve({ client: inngest, functions }));

// Register feature-specific API routes.
app.use('/api/show', showRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);

// Catch-all handler for undefined routes.
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized error handler to ensure consistent API responses.
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || 'Server error' });
});

// Start the HTTP server after all middleware and routes are configured.
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

export default app;
