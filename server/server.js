import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import mongoConnect from './config/database.js';
import { clerkMiddleware } from '@clerk/express';
import { serve } from 'inngest/express';
import { inngest, functions } from './Inngest/index.js';
import showRouter from './Routes/showrouter.js';
import bookingRouter from './Routes/bookingrouter.js';
import adminRouter from './Routes/adminrouter.js';
import userRouter from './Routes/userrouter.js';
import { stripeWebhooks } from './Control/Stripewebhooks.js';
import { protectOwner } from './Middleware/Auth.js';
import { allowedOrigins } from './lib/origins.js';
import { syncShows, getScheduleState } from './lib/autoSchedule.js';
import sendEmail from './config/nodemailer.js';

const app = express();
const port = process.env.PORT || 3000;
app.disable('x-powered-by');

// Start connecting to MongoDB immediately (module load), and make sure every
// API request waits for the connection. A failed connection is retried on the
// next request instead of crashing the process.
mongoConnect().catch(() => {});
const needDb = async (_req, _res, next) => {
  try {
    await mongoConnect();
    next();
  } catch (err) {
    next(Object.assign(new Error('Database unavailable, please retry'), { status: 503 }));
  }
};

// Request logger (debugging). Set REQUEST_LOG=0 to silence it.
if (process.env.REQUEST_LOG !== '0') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// Restrict browser access to known frontend origins (FRONTEND_URL, EXTRA_ORIGINS, localhost).
// The cors middleware also answers OPTIONS preflights, so no separate app.options() is needed
// (and app.options("*") throws on Express 5's router).
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      console.log('❌ Blocked Origin:', origin);
      return cb(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
    },
    credentials: true,
    maxAge: 86400, // let browsers cache the preflight for a day
  })
);

// Stripe webhook endpoint.
// Stripe requires the raw request body to verify webhook signatures,
// so JSON parsing is intentionally skipped for this route.
app.post('/api/stripe', express.raw({ type: 'application/json' }), needDb, stripeWebhooks);

app.use(express.json({ limit: '200kb' }));

// Clerk authentication (reads the Bearer token; no network call per request).
// Role lookups now happen only on routes that need them (see Middleware/Auth.js) —
// the old global "auto-promote" and "demo flag" middlewares called Clerk's API
// 2x on every signed-in request.
app.use(clerkMiddleware());

// Health check endpoints.
app.get('/', (_req, res) => res.send('Server is live!'));
app.get('/api/health', needDb, async (_req, res) => {
  const state = await getScheduleState().catch(() => null);
  res.json({ ok: true, lastScheduleSync: state?.lastSuccessAt || null });
});

// Owner-only route for verifying SMTP configuration.
app.get('/api/dev/test-email', protectOwner, async (_req, res) => {
  try {
    const to = process.env.TEST_EMAIL_TO || process.env.OWNER_EMAIL?.split(',')[0];
    await sendEmail({ to, subject: 'CineGo test email', body: '<p>If you see this, SMTP works.</p>' });
    res.json({ ok: true, to });
  } catch (e) {
    res.status(500).json({ ok: false, err: e.message });
  }
});

// Daily automatic schedule, called by Vercel Cron (see vercel.json) or any external
// scheduler (cron-job.org, GitHub Actions...). Protected by CRON_SECRET.
app.get('/api/cron/sync-shows', needDb, async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const result = await syncShows({ reason: 'cron' });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Inngest endpoint for background and scheduled jobs (daily schedule, seat release, emails).
app.use('/api/inngest', serve({ client: inngest, functions }));

// Register feature-specific API routes.
app.use('/api/show', needDb, showRouter);
app.use('/api/booking', needDb, bookingRouter);
app.use('/api/admin', needDb, adminRouter);
app.use('/api/user', needDb, userRouter);

// Catch-all handler for undefined routes.
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized error handler to ensure consistent API responses.
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  console.error(`Global Error (${req.method} ${req.originalUrl}):`, status >= 500 ? err : err.message);
  res.status(status).json({ success: false, message: err.message || 'Server error' });
});

// On Vercel the exported app is the request handler; everywhere else we listen.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });

  // Always-on hosts (Render, Railway, a VPS, local dev): keep the schedule fresh
  // without any external cron. Checks shortly after boot and then every 6 hours;
  // only actually syncs when the last successful run is older than 20 hours.
  if (process.env.AUTO_SCHEDULE !== '0') {
    const tick = async () => {
      try {
        await mongoConnect();
        const state = await getScheduleState();
        const last = state?.lastSuccessAt ? new Date(state.lastSuccessAt).getTime() : 0;
        if (Date.now() - last > 20 * 60 * 60 * 1000) await syncShows({ reason: 'server-timer' });
      } catch (err) {
        console.error('[auto-schedule] timer run failed:', err.message);
      }
    };
    setTimeout(tick, 10 * 1000).unref();
    setInterval(tick, 6 * 60 * 60 * 1000).unref();
  }
}

export default app;
