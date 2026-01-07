// Purpose: Stores basic user profile data inside MongoDB.
// This model mirrors user data from Clerk so the app can
// easily link users with bookings and other records.

import mongoose from "mongoose";
import { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    // Clerk userId is used as the primary key
    // Stored as string because Clerk manages users externally
    _id: { type: String, required: true },

    // User's full name (from Clerk)
    name: { type: String, required: true },

    // User's email address
    email: { type: String, required: true },

    // Profile image URL
    image: { type: String, required: true },
  },
  {
    // Keeps track of when the user record was created or updated
    timestamps: true,
  }
);

// Export model (reuse if already compiled to avoid hot-reload issues)
export default mongoose.models.User ||
  mongoose.model("User", UserSchema);
