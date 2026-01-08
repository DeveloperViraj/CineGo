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

INGEST_API_KEY=ingest_xxx
DEMO_CODE=demo123
```

### Frontend (`client/.env`)
```env
VITE_BASE_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

---

##  Running the Project

Backend:
```bash
cd server
npm run dev
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
