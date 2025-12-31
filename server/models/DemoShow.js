// Purpose: Represents demo-only movie shows.
// Demo shows are used for testing and showcasing admin features
// without affecting real production shows or bookings.

import mongoose, { Schema } from "mongoose";

const demoShowSchema = new Schema(
  {
    // Reference to the movie being shown
    // Stored as a string to keep demo data lightweight and isolated
    movie: { type: String, ref: "Movie", required: true },

    // Date and time when the demo show runs
    showDateTime: { type: Date, required: true },

    // Ticket price for the demo show
    showprice: { type: Number, required: true },

    // Tracks which seats are occupied in demo mode
    // Stored as a simple object instead of a Map for flexibility
    occupiedSeats: { type: Object, default: {} },

    // Explicit flag to indicate this is a demo show
    isDemo: { type: Boolean, default: true },

    // Clerk userId of the demo user who owns this show
    // Indexed to allow fast lookup per demo user
    demoOwner: { type: String, required: true, index: true },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// Reuse model if already compiled (prevents errors in dev / hot reload)
export default mongoose.models.DemoShow ||
  mongoose.model("DemoShow", demoShowSchema);
