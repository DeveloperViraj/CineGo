// Purpose: Stores a single ticket booking made by a user.
// Each booking links a user to a specific show, tracks seats,
// payment status, and keeps timestamps for history and sorting.

import mongoose from "mongoose";
import { Schema } from "mongoose";

const bookingSchema = new Schema(
  {
    // Clerk userId is stored as a string (not ObjectId)
    // because Clerk manages users externally
    user: { type: String, required: true },

    // Reference to the Show document being booked
    // ObjectId is required so we can populate show + movie details
    show: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Show",
    },

    // Total booking amount (price × number of seats)
    amount: { type: Number, required: true },

    // List of seat identifiers booked by the user (e.g., A1, B3)
    bookedseats: { type: [String], required: true },

    // Payment status, updated by Stripe webhook
    isPaid: { type: Boolean, default: false },

    // Stripe checkout URL used for payment
    paymentLink: { type: String },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

export default mongoose.model("Booking", bookingSchema);
