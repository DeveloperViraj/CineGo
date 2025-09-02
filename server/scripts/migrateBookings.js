import mongoose from "mongoose";
import Booking from "../models/Booking.js";

const MONGO_URI = process.env.MONGO_URI;;
(async () => {
  try {
    await mongoose.connect(MONGO_URI);

    const bookings = await Booking.find({});
    for (const booking of bookings) {
      if (typeof booking.show === "string") {
        // Convert string to ObjectId
        booking.show = new mongoose.Types.ObjectId(booking.show);
        await booking.save();
        console.log(`Migrated booking ${booking._id}`);
      }
    }

    console.log("✅ Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();
