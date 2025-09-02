// server/models/Movie.js
import mongoose, { Schema } from "mongoose";

const movieSchema = new Schema(
  {
    tmdbId: { type: String, index: true, unique: true, sparse: true },
    originalTitle: { type: String, required: true },
    description: { type: String, required: true },
    primaryImage: { type: String, required: true },
    thumbnails: { type: Array, required: true },
    trailer: { type: String },
    releaseDate: { type: String, required: true },
    original_language: { type: Array },
    genres: { type: Array, required: true },
    casts: { type: Array, required: true },
    averageRating: { type: Number },
    runtime: { type: Number },
    numVotes: { type: Number },
  },
  { timestamps: true }
);


export default mongoose.model("Movie", movieSchema);
