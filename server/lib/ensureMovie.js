// server/lib/ensureMovie.js
import axios from "axios";
import mongoose from "mongoose";
import Movie from "../models/Movie.js";

/**
 * Ensure a Movie doc exists for a given TMDB id.
 * - Stores tmdbId as a STRING (consistent with your current data).
 * - Returns Movie._id (string, since your schema uses _id: String).
 */
export async function ensureMovieByTmdb(tmdbId, fallback = {}) {
  if (!tmdbId) throw new Error("tmdbId is required");
  const idStr = String(tmdbId);

  // 1) Already have it?
  const existing = await Movie.findOne({ tmdbId: idStr }).select("_id").lean();
  if (existing?._id) return existing._id;

  // 2) Try TMDB (best-effort)
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
    // ignore; we'll fallback
  }

  // 3) Build a valid Movie doc for your schema (all required fields present)
  const doc = new Movie({
    _id: new mongoose.Types.ObjectId().toString(),        // your schema uses String _id
    tmdbId: idStr,
    originalTitle:
      payload?.title ||
      payload?.original_title ||
      fallback.title ||
      "Untitled",
    description: payload?.overview || fallback.description || "",
    primaryImage: payload?.poster_path
      ? `https://image.tmdb.org/t/p/original${payload.poster_path}`
      : (fallback.primaryImage || ""),
    thumbnails: [],
    trailer: "",
    releaseDate:
      payload?.release_date ||
      fallback.releaseDate ||
      new Date().toISOString().slice(0, 10),             // "YYYY-MM-DD"
    original_language: payload?.original_language ? [payload.original_language] : [],
    genres: (payload?.genres || []).map(g => g?.name).filter(Boolean),
    casts: [],
    averageRating: Number(payload?.vote_average || 0),
    runtime: Number(payload?.runtime || 0),
    numVotes: Number(payload?.vote_count || 0),
  });

  await doc.save();
  return doc._id;
}
