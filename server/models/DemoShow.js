import mongoose, { Schema } from "mongoose";

const demoShowSchema = new Schema(
  {
    movie: { type: String, ref: "Movie", required: true },

    showDateTime: { type: Date, required: true },
    showprice: { type: Number, required: true },

    occupiedSeats: { type: Object, default: {} },

    isDemo: { type: Boolean, default: true },
    demoOwner: { type: String, required: true, index: true }, // Clerk userId
  },
  { timestamps: true }
);

export default mongoose.models.DemoShow || mongoose.model("DemoShow", demoShowSchema);
