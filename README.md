# 🎬 CineGo (Full-Stack Movie Ticket Booking System)

CineGo is a full-stack MERN application that simulates a real-world movie ticket booking platform.  
Users can browse movies, select seats in real time, make secure payments, and receive email confirmations.  
Admins can manage shows, track bookings, and view revenue analytics.

This project focuses on real production concepts like authentication, payments, background jobs, and role-based access.

---

##  Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Axios
- React Router
- Clerk (Authentication)

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Clerk (Auth + Roles)
- Stripe (Payments + Webhooks)
- Nodemailer (Emails)
- Inngest (Background jobs)

---

## Core Features

- User authentication using Clerk
- Browse movies fetched from TMDB
- Real-time seat selection & locking
- Secure checkout using Stripe
- Email confirmations after payment
- Admin dashboard for shows, bookings, and revenue
- Demo mode for safe testing without affecting real data
- Background jobs for payment checks and cleanup
- **Fully automatic catalog**: what's playing in cinemas is synced from TMDB every day and shows are kept bookable 14 days ahead — no manual updates

---

##  High-Level Flow

1. User logs in via Clerk
2. Movies are fetched and stored from TMDB
3. User selects seats for a show
4. Seats are locked temporarily
5. Stripe Checkout is created
6. Webhook confirms payment
7. Booking is marked as paid
8. Email confirmation is sent
9. Background jobs handle cleanup and retries

---

## Automatic movies & shows

`server/lib/autoSchedule.js` keeps the cinema stocked on its own:

1. Reads TMDB **now playing** for your region (`TMDB_REGION`, default `IN`) and keeps the top `AUTO_MOVIE_COUNT` (12) movies on sale.
2. Creates shows `AUTO_SCHEDULE_DAYS` (14) days ahead at fixed daily slots (`AUTO_SHOW_TIMES`, India time), with weekday/weekend and matinee/prime pricing.
3. Is idempotent (never duplicates shows), locked against overlapping runs, and removes old unbooked auto-shows.
4. Falls back to the movies it already knows if TMDB is down, so something is always bookable.

It runs from any of these (use at least one):

| Trigger | Setup |
| --- | --- |
| Inngest cron, 03:00 IST daily | Sync the app in the Inngest dashboard (`/api/inngest`), set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` |
| Vercel Cron (`server/vercel.json`) | Set `CRON_SECRET` in the Vercel project; Vercel calls `/api/cron/sync-shows` daily |
| Built-in timer | Automatic on always-on hosts (Render, Railway, VPS, local) |
| Self-healing | If the catalog is empty or a daily run was missed, the next visitor's request triggers a refresh |

Admins can also press **Sync now** on the dashboard. Manual "Add Shows" still works for special screenings.

---

##  Project Structure

```txt
CineGo/
├── client/
│   ├── src/
│   └── package.json
├── server/
│   ├── config/
│   ├── Control/
│   ├── Middleware/
│   ├── Inngest/
│   ├── Routes/
│   ├── models/
│   └── server.js
└── README.md
```

---

##  Installation & Setup

### Clone the repository
```bash
git clone https://github.com/your-username/cinego.git
cd cinego
```

### Install dependencies

Frontend:
```bash
cd client
npm install
```

Backend:
```bash
cd server
npm install
```

---

##  Environment Variables

### Backend (`server/.env`)
```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/

CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
OWNER_EMAIL=youremail@gmail.com
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

TMDB_KEY=eyJhbGciOiJIUzI1NiIs...

EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_app_password
SENDER_EMAIL=yourgmail@gmail.com

INNGEST_EVENT_KEY=xxx            # INGEST_API_KEY also works
INNGEST_SIGNING_KEY=signkey-prod-xxx
DEMO_CODE=demo123
FRONTEND_URL=https://your-frontend.vercel.app
CRON_SECRET=any-long-random-string
```

See `server/.env.example` for the optional automation settings (region, number of movies, days ahead, show times, prices).

Stripe webhook events to subscribe: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`.

### Frontend (`client/.env`)
```env
VITE_BASE_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_CURRENCY=₹
```

---

##  Running the Project

Backend:
```bash
cd server
npm run server
```

Frontend:
```bash
cd client
npm run dev
```

---

##  Roles & Access

- User: Book tickets, manage favorites
- Admin: Add shows, view bookings, analytics
- Owner: Manage admins
- Demo User: Limited admin-like access

---

##  Emails & Background Jobs

- Emails via Nodemailer + Gmail SMTP
- Stripe webhooks confirm payments
- Inngest handles retries, cleanup, notifications
