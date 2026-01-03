// Purpose: Stores movie metadata used across the application.
// This collection acts as the central source of truth for movies,
// whether they are fetched from TMDB or created during demo/admin flows.

import mongoose, { Schema } from "mongoose";

const movieSchema = new Schema(
  {
    // TMDB movie ID (used to avoid duplicates and sync external data)
    // Indexed and unique so the same movie is never stored twice
    tmdbId: { type: String, index: true, unique: true, sparse: true },

    // Official movie title shown across the UI
    originalTitle: { type: String, required: true },

    // Movie overview/summary
    description: { type: String, required: true },

    // Main poster image used in listings and details page
    primaryImage: { type: String, required: true },

    // Additional images (backdrops, banners, etc.)
    thumbnails: { type: Array, required: true },

    // YouTube trailer URL (optional, fetched from TMDB)
    trailer: { type: String },

    // Release date as a string (kept simple for display)
    releaseDate: { type: String, required: true },

    // Languages spoken in the movie
    original_language: { type: Array },

    // Movie genres (Action, Drama, Thriller, etc.)
    genres: { type: Array, required: true },

    // Cast details (limited set for UI clarity)
    casts: { type: Array, required: true },

    // Average rating from TMDB
    averageRating: { type: Number },

    // Movie runtime in minutes
    runtime: { type: Number },

    // Number of votes used to calculate rating
    numVotes: { type: Number },
  },
  {
    // Automatically tracks when the movie was created or updated
    timestamps: true,
  }
);

// Reuse existing model if already compiled (prevents hot-reload issues)
export default mongoose.models.Movie ||
  mongoose.model("Movie", movieSchema);
