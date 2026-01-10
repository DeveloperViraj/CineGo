import mongoose from "mongoose";
import Booking from "../models/Booking.js";

const MONGO_URI = process.env.MONGO_URI;

// This script is a one-time database migration.
// Earlier versions stored `booking.show` as a string.
// The application now expects it to be a MongoDB ObjectId.
// This script safely converts existing records to the new format.

(async () => {
  try {
    // Connect directly to MongoDB using the environment connection string
    await mongoose.connect(MONGO_URI);

    // Fetch all existing bookings
    const bookings = await Booking.find({});

    for (const booking of bookings) {
      // If show is stored as a string, convert it to ObjectId
      if (typeof booking.show === "string") {
        booking.show = new mongoose.Types.ObjectId(booking.show);
        await booking.save();
      }
    }

    // Exit successfully after migration completes
    process.exit(0);
  } catch (err) {
    // Exit with failure if anything goes wrong
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();
