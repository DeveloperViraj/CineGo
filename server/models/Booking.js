import mongoose from "mongoose";
import { Schema } from "mongoose";

const bookingSchema = new Schema(
  {
    user: { type: String, required: true }, // Clerk userId stays string
    show: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Show" }, // must be ObjectId
    amount: { type: Number, required: true },
    bookedseats: { type: [String], required: true },
    isPaid: { type: Boolean, default: false },
    paymentLink: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
