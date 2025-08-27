// server/lib/ensureMovie.js
import mongoose from "mongoose";
import axios from "axios";
import Movie from "../models/Movie.js";

/**
 * Ensure a Movie exists for a TMDB id.
 * - Movie._id is a STRING (your schema).
 * - Movie.tmdbId is a STRING (unique+sparse).
 * Returns the Movie._id (string).
 */
export async function ensureMovieByTmdb(tmdbId, fallback = {}) {
  const idStr = String(tmdbId || "").trim();
  if (!idStr) throw new Error("tmdbId is required");

  // Try to fetch details, but don't fail if TMDB is unavailable
  let payload = null;
  try {
    const key = process.env.TMDB_API_KEY;
    if (key) {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/movie/${idStr}`,
        { params: { api_key: key, language: "en-US" } }
      );
      payload = data || null;
    }
  } catch {
    // swallow; we'll fall back to minimal data
  }

  // Build doc we will insert if missing (must include _id because your schema requires it)
  const docIfMissing = {
    _id: new mongoose.Types.ObjectId().toString(), // String _id
    tmdbId: idStr,
    originalTitle: payload?.title || payload?.original_title || fallback.title || "Untitled",
    description: payload?.overview || fallback.description || "",
    primaryImage: payload?.poster_path
      ? `https://image.tmdb.org/t/p/original${payload.poster_path}`
      : (fallback.primaryImage || ""),
    thumbnails: [],
    trailer: "",
    releaseDate:
      payload?.release_date ||
      fallback.releaseDate ||
      new Date().toISOString().slice(0, 10), // "YYYY-MM-DD"
    original_language: payload?.original_language ? [payload.original_language] : [],
    genres: (payload?.genres || []).map((g) => g?.name).filter(Boolean),
    casts: [],
    averageRating: Number(payload?.vote_average || 0),
    runtime: Number(payload?.runtime || 0),
    numVotes: Number(payload?.vote_count || 0),
  };

  // Atomic upsert: if movie exists, return it; otherwise insert docIfMissing
  const m = await Movie.findOneAndUpdate(
    { tmdbId: idStr },
    { $setOnInsert: docIfMissing, $set: { updatedAt: new Date() } },
    { upsert: true, new: true, projection: { _id: 1 } }
  ).lean();

  return m._id; // string
}
