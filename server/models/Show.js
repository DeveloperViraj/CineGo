import mongoose, { Schema } from "mongoose";

const showSchema = new Schema(
  {
   movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },


    showDateTime: { type: Date, required: true },
    showprice: { type: Number, required: true },

    occupiedSeats: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.Show || mongoose.model("Show", showSchema);
