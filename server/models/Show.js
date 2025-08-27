import mongoose, { Schema } from "mongoose";

const showSchema = new Schema(
  {
    // IMPORTANT: Movie._id is a String in your app, so the ref must be String too
    movie: { type: String, ref: "Movie", required: true },

    showDateTime: { type: Date, required: true },
    showprice: { type: Number, required: true },

    // Keep this as a plain object; it's easier to JSON-serialize
    occupiedSeats: { type: Object, default: {} },
  },
  { timestamps: true }
);

// Guard against OverwriteModelError in serverless/hot reload setups
export default mongoose.models.Show || mongoose.model("Show", showSchema);
