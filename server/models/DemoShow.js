import mongoose, { Schema } from "mongoose";

const demoShowSchema = new Schema(
  {
    // Same fields as Show, but demo flags added
    movie: { type: String, ref: "Movie", required: true },

    showDateTime: { type: Date, required: true },
    showprice: { type: Number, required: true },

    occupiedSeats: { type: Object, default: {} },

    // Demo-only flags
    isDemo: { type: Boolean, default: true },
    demoOwner: { type: String, required: true, index: true }, // Clerk userId
  },
  { timestamps: true }
);

export default mongoose.models.DemoShow || mongoose.model("DemoShow", demoShowSchema);
