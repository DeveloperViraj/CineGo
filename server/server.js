import express from "express";
import cors from "cors";
import "dotenv/config";

import mongoConnect from "./config/database.js";
import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import { serve } from "inngest/express";

import { inngest, functions } from "./Inngest/index.js";

import showRouter from "./Routes/showrouter.js";
import bookingRouter from "./Routes/bookingrouter.js";
import adminRouter from "./Routes/adminrouter.js";
import userRouter from "./Routes/userrouter.js";

import { stripeWebhooks } from "./Control/Stripewebhooks.js";
import { attachDemoFlag } from "./Middleware/Demo.js";

import sendEmail from "./config/nodemailer.js";

const app = express();
const port = process.env.PORT || 3000;

// --------------------------------------------------
// MongoDB
// --------------------------------------------------

await mongoConnect();

// --------------------------------------------------
// Request Logger (Debugging)
// --------------------------------------------------

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// --------------------------------------------------
// CORS
// --------------------------------------------------

const allowed = new Set(
  [
    process.env.FRONTEND_URL,
    "https://cinego-chi.vercel.app",
    "http://localhost:5173",
    "http://localhost:5176",
  ].filter(Boolean)
);

const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowed.has(origin)) {
      return cb(null, true);
    }

    console.log("❌ Blocked Origin:", origin);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// --------------------------------------------------
// Stripe Webhook
// --------------------------------------------------

app.post(
  "/api/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhooks
);

// --------------------------------------------------
// JSON Parser
// Skip Stripe because it requires raw body
// --------------------------------------------------

app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/stripe")) {
    return next();
  }

  express.json()(req, res, next);
});

// --------------------------------------------------
// Clerk
// --------------------------------------------------

app.use(clerkMiddleware());
app.use(attachDemoFlag());

// --------------------------------------------------
// Auto Promote Admin
// --------------------------------------------------

app.use(async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) return next();

    const user = await clerkClient.users.getUser(userId);

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const primaryEmail = user.emailAddresses
      ?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    if (
      primaryEmail &&
      adminEmails.includes(primaryEmail) &&
      user.privateMetadata?.role !== "admin"
    ) {
      await clerkClient.users.updateUser(userId, {
        privateMetadata: {
          ...user.privateMetadata,
          role: "admin",
        },
      });

      console.log(" Auto-promoted admin:", primaryEmail);
    }
  } catch (err) {
    console.error("Auto Promote Error:", err);
  }

  next();
});

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/", (_, res) => {
  res.send("Server is live!");
});

// --------------------------------------------------
// SMTP Test Route
// --------------------------------------------------

app.get("/api/dev/test-email", async (_, res) => {
  try {
    await sendEmail({
      to: process.env.TEST_EMAIL_TO,
      subject: "CineGo Test Email",
      body: "<h2>Email configuration is working 🎉</h2>",
    });

    res.json({
      ok: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

// --------------------------------------------------
// Inngest
// --------------------------------------------------

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions,
  })
);

// --------------------------------------------------
// Routes
// --------------------------------------------------

app.use("/api/show", showRouter);
app.use("/api/booking", bookingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// --------------------------------------------------
// Global Error Handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error(" Global Error:");
  console.error(err);

  if (res.headersSent) return;

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(port, () => {
  console.log(` Server running on port ${port}`);
});

export default app;
