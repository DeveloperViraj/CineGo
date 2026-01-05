// Purpose: Represents a single movie show (specific date and time).
// This model is central to the booking system because seats are locked
// and released based on this document.

import mongoose, { Schema } from "mongoose";

const showSchema = new Schema(
  {
    // Reference to the movie being shown
    // Stored as ObjectId so we can populate full movie details when needed
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
    },

    // Date and time when the show starts
    showDateTime: { type: Date, required: true },

    // Ticket price for a single seat in this show
    showprice: { type: Number, required: true },

    // Tracks seat occupancy for this show
    // Keys are seat labels (e.g., A1, B2), values are booleans
    // Stored as an object for fast read/write during seat selection
    occupiedSeats: { type: Object, default: {} },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// Reuse existing model if already compiled (prevents issues during hot reload)
export default mongoose.models.Show || mongoose.model("Show", showSchema);
