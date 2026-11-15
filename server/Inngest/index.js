// Purpose: Handles background jobs and event-based tasks using Inngest.
// These tasks run outside the main request-response cycle
// (scheduled show updates, seat release, cleanup, emails, syncing users).

import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import Movie from "../models/Movie.js";
import sendEmail from "../config/nodemailer.js";
import mongoConnect from "../config/database.js";
import { newMovieEmail } from "../lib/emails.js";
import { syncShows } from "../lib/autoSchedule.js";
import { releaseUnpaidBooking, releaseStaleHolds, SEAT_HOLD_MINUTES } from "../lib/bookings.js";

// Create Inngest client
export const inngest = new Inngest({
  id: "movie-ticket-booking",
  eventKey: process.env.INNGEST_EVENT_KEY || process.env.INGEST_API_KEY,
});

const fullName = (first, last) => [first, last].filter(Boolean).join(" ") || "CineGo user";

function userFromClerk(data) {
  const { id, first_name, last_name, email_addresses, image_url, primary_email_address_id } = data;
  const primary =
    email_addresses?.find((e) => e.id === primary_email_address_id) || email_addresses?.[0];
  return {
    _id: id,
    name: fullName(first_name, last_name),
    email: primary?.email_address || "",
    image: image_url || "",
  };
}

//  USER SYNC (CLERK → DB)
// Upserts make these safe to retry (Inngest retries failed functions)

const userCreated = inngest.createFunction(
  { id: "create-user" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    await mongoConnect();
    const doc = userFromClerk(event.data);
    await User.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
  }
);

const userUpdated = inngest.createFunction(
  { id: "update-user" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    await mongoConnect();
    const doc = userFromClerk(event.data);
    await User.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
  }
);

const userDeleted = inngest.createFunction(
  { id: "delete-user" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await mongoConnect();
    await User.findByIdAndDelete(event.data.id);
  }
);

//  AUTOMATIC NOW-PLAYING SCHEDULE
// Runs every day at 03:00 India time, and on demand (event "app/shows.sync")
// when the API notices the schedule is empty or a daily run was missed.
const syncNowPlayingShows = inngest.createFunction(
  { id: "sync-now-playing-shows", concurrency: { limit: 1 }, retries: 2 },
  [{ cron: "TZ=Asia/Kolkata 0 3 * * *" }, { event: "app/shows.sync" }],
  async ({ event, step }) => {
    const result = await step.run("sync-movies-and-shows", async () => {
      await mongoConnect();
      return syncShows({ reason: event?.data?.reason || "cron" });
    });
    const released = await step.run("release-stale-seat-holds", async () => {
      await mongoConnect();
      return releaseStaleHolds();
    });
    return { ...result, staleHoldsReleased: released };
  }
);

//  PAYMENT CHECK & SEAT RELEASE
// If payment is not completed within SEAT_HOLD_MINUTES (default 10):
// expire the Stripe session, free the seats, delete the unpaid booking.
const releaseSeatsandDeletebooking = inngest.createFunction(
  { id: "relese-seats-delete-booking" },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    await step.sleep("wait-for-payment", `${SEAT_HOLD_MINUTES}m`);
    return step.run("check-payment-status", async () => {
      await mongoConnect();
      const released = await releaseUnpaidBooking(event.data.bookingId);
      return { released };
    });
  }
);

//  PERIODIC CLEANUP
// Runs twice a year (Jan & July): deletes bookings and shows older than 6 months
export const cleanupOldData = inngest.createFunction(
  { id: "cleanup-old-bookings-shows" },
  { cron: "0 0 1 1,7 *" },
  async ({ step }) => {
    return step.run("delete-old-bookings-and-shows", async () => {
      await mongoConnect();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const deletedBookings = await Booking.deleteMany({ createdAt: { $lt: sixMonthsAgo } });
      const deletedShows = await Show.deleteMany({ showDateTime: { $lt: sixMonthsAgo } });
      return {
        deletedBookings: deletedBookings.deletedCount,
        deletedShows: deletedShows.deletedCount,
      };
    });
  }
);

//  NEW MOVIE ANNOUNCEMENT EMAIL
// Sent when an admin manually adds a movie that wasn't showing before.
// (The automatic daily schedule never triggers this, so users aren't spammed.)
const sendNewMovieEmail = inngest.createFunction(
  { id: "send-new-movie-notification" },
  { event: "app/show.added" },
  async ({ event, step }) => {
    const recipients = await step.run("load-recipients", async () => {
      await mongoConnect();
      const users = await User.find({ email: { $ne: "" } }).select("name email").lean();
      return users.map((u) => ({ name: u.name, email: u.email }));
    });

    const movie = await step.run("load-movie", async () => {
      await mongoConnect();
      const m = await Movie.findById(event.data.movieId).lean();
      return m ? JSON.parse(JSON.stringify(m)) : null;
    });
    if (!movie) return { sent: 0 };

    let sent = 0;
    for (const user of recipients) {
      try {
        const { subject, body } = newMovieEmail({ name: user.name, movie });
        await sendEmail({ to: user.email, subject, body });
        sent++;
      } catch (e) {
        console.error("New movie email failed for", user.email, e.message);
      }
    }
    return { sent };
  }
);

// Export all functions so Inngest can register them
export const functions = [
  userCreated,
  userUpdated,
  userDeleted,
  syncNowPlayingShows,
  releaseSeatsandDeletebooking,
  cleanupOldData,
  sendNewMovieEmail,
];
