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

const app = express();
const port = process.env.PORT || 3000;

// --- Connect DB
await mongoConnect();

// --- Stripe webhook BEFORE body parsers
app.post('/api/stripe', express.raw({ type: 'application/json' }), stripeWebhooks);

// --- JSON parser for everything else
app.use(express.json());

// --- CORS allow-list
const allowed = new Set([
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5176',
].filter(Boolean));

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// --- Clerk
app.use(clerkMiddleware());
app.use(attachDemoFlag);

// --- Auto-promote admin (optional)
app.use(async (req, _res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return next();

    const user = await clerkClient.users.getUser(userId);
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    const primaryEmail = user?.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    if (primaryEmail && adminEmails.includes(primaryEmail) && user.privateMetadata?.role !== 'admin') {
      await clerkClient.users.updateUser(userId, {
        privateMetadata: { ...user.privateMetadata, role: 'admin' }
      });
    }
  } catch {
    // swallow errors
  }
  next();
});

// --- Health check
app.get('/', (_req, res) => res.send('Server is live!'));

// --- Inngest route (important for sync!)
app.use('/api/inngest', serve({ client: inngest, functions }));

// --- API Routers
app.use('/api/show', showRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);

// --- 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// --- Global error handler
app.use((err, req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') console.error('Global error:', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

app.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});

export default app;
