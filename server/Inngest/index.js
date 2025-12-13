// Purpose: Handles background jobs and event-based tasks using Inngest.
// These tasks run outside the main request-response cycle
// (emails, cleanup jobs, delayed actions, syncing users).

import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../config/nodemailer.js";
import Movie from "../models/Movie.js";

// Create Inngest client
// This connects our app to Inngest using an API key
export const inngest = new Inngest({
  id: "movie-ticket-booking",
  eventKey: process.env.INGEST_API_KEY,
});

//  USER SYNC (CLERK → DB) 

// Create user in MongoDB when a user signs up in Clerk
const userCreated = inngest.createFunction(
  { id: "create-user" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;

    const userdata = {
      _id: id,
      name: first_name + " " + last_name,
      email: email_addresses[0].email_address,
      image: image_url,
    };

    await User.create(userdata);
  }
);

// Update user details in MongoDB when Clerk profile changes
const userUpdated = inngest.createFunction(
  { id: "update-user" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;

    const userdata = {
      _id: id,
      name: first_name + " " + last_name,
      email: email_addresses[0].email_address,
      image: image_url,
    };

    await User.findByIdAndUpdate(id, userdata);
  }
);

// Delete user from MongoDB when account is deleted in Clerk
const userDeleted = inngest.createFunction(
  { id: "delete-user" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    const { id } = event.data;
    await User.findByIdAndDelete(id);
  }
);

//  PAYMENT CHECK & SEAT RELEASE 

// If payment is not completed within 10 minutes:
// - Free the seats
// - Delete the booking
const releaseSeatsandDeletebooking = inngest.createFunction(
  { id: "relese-seats-delete-booking" },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    const tenminutes = new Date(Date.now() + 10 * 60 * 1000);

    // Wait for 10 minutes before checking payment status
    await step.sleepUntil("Wait-for-10-minutes", tenminutes);

    await step.run("check-payment-status", async () => {
      const bookingId = event.data.bookingId;
      const booking = await Booking.findById(bookingId);

      if (!booking.isPaid) {
        const show = await Show.findById(booking.show);

        booking.bookedseats.forEach((seat) => {
          delete show.occupiedSeats[seat];
        });

        show.markModified("occupiedSeats");
        await show.save();
        await Booking.findByIdAndDelete(booking._id);
      }
    });
  }
);

//  PERIODIC CLEANUP 
// Runs twice a year (Jan & July)
// Deletes old bookings and shows older than 6 months
export const cleanupOldData = inngest.createFunction(
  { id: "cleanup-old-bookings-shows" },
  { cron: "0 0 1 1,7 *" },
  async ({ step }) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return step.run("delete-old-bookings-and-shows", async () => {
      const deletedBookings = await Booking.deleteMany({
        createdAt: { $lt: sixMonthsAgo },
      });

      const deletedShows = await Show.deleteMany({
        showDateTime: { $lt: sixMonthsAgo },
      });

      return {
        deletedBookings: deletedBookings.deletedCount,
        deletedShows: deletedShows.deletedCount,
      };
    });
  }
);

// BOOKING CONFIRMATION EMAIL 

// Sends booking confirmation email after payment success
const sendbookingEmail = inngest.createFunction(
  { id: "send-booking-confirmation-mail" },
  { event: "app/show.booked" },
  async ({ event }) => {
    const { bookingId } = event.data;

    try {
      const booking = await Booking.findById(bookingId).populate({
        path: "show",
        populate: { path: "movie", model: "Movie" },
      });

      if (!booking || !booking.show || !booking.show.movie) return;

      const user = await User.findById(booking.user);
      if (!user) return;

      const showTime = new Date(
        booking.show.showDateTime
      ).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" });

      const showDate = new Date(
        booking.show.showDateTime
      ).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });

      await sendEmail({
        to: user.email,
        subject: `Payment confirmation: '${booking.show.movie.originalTitle}' booked!`,
        body: `...`, // email HTML unchanged
      });
    } catch (error) {
      console.error("Error in sendbookingEmail:", error);
    }
  }
);

// NEW MOVIE ANNOUNCEMENT EMAIL 

// Sends email to all users when a new movie/show is added
const sendNewMovieEmail = inngest.createFunction(
  { id: "send-new-movie-notification" },
  { event: "app/show.added" },
  async ({ event }) => {
    const { movieId } = event.data;
    const users = await User.find({});
    const movie = await Movie.findById(movieId);

    if (!movie) return;

    for (const user of users) {
      await sendEmail({
        to: user.email,
        subject: `🎬 New Show Added: ${movie.originalTitle}`,
        body: `...`, // email HTML unchanged
      });
    }
  }
);

// Export all functions so Inngest can register them
export const functions = [
  userCreated,
  userUpdated,
  userDeleted,
  releaseSeatsandDeletebooking,
  cleanupOldData,
  sendbookingEmail,
  sendNewMovieEmail,
];
