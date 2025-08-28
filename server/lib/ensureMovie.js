// server/lib/ensureMovie.js
import axios from "axios";
import Movie from "../models/Movie.js";

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/original";

export async function ensureMovieByTmdb(tmdbId, fallback = {}) {
  const id = String(tmdbId);

  // If already present, we're done
  const existing = await Movie.findById(id).lean();
  if (existing) return id;

  const key = process.env.TMDB_API_KEY;
  if (!key && !fallback.title) {
    throw new Error("TMDB_API_KEY missing and no fallback provided");
  }

  let title = fallback.title || "Untitled";
  let overview = fallback.overview || "";
  let poster_path = fallback.poster_path || "";
  let release_date = fallback.release_date || "";
  let runtime = fallback.runtime ?? null;
  let vote_average = fallback.vote_average ?? null;
  let vote_count = fallback.vote_count ?? null;
  let genres = fallback.genres || [];
  let original_language = fallback.original_language
    ? [fallback.original_language]
    : [];

  // Try TMDB if we have a key
  if (key) {
    try {
      const { data } = await axios.get(`${TMDB}/movie/${id}`, {
        params: { api_key: key, language: "en-US" },
      });
      title = data.title || data.original_title || title;
      overview = data.overview ?? overview;
      poster_path = data.poster_path ?? poster_path;
      release_date = data.release_date ?? release_date;
      runtime = data.runtime ?? runtime;
      vote_average = data.vote_average ?? vote_average;
      vote_count = data.vote_count ?? vote_count;
      genres = (data.genres || []).map(g => g.name);
      original_language = data.original_language
        ? [data.original_language]
        : original_language;
    } catch (e) {
      // keep fallback values
    }
  }

  const primaryImage = poster_path ? `${IMG}${poster_path}` : (fallback.primaryImage || "");
  const doc = {
    _id: id,                       // IMPORTANT: TMDB id as String
    originalTitle: title,
    description: overview || "No description.",
    primaryImage,
    thumbnails: primaryImage ? [primaryImage] : [],
    trailer: "",                   // optional
    releaseDate: release_date || (fallback.releaseDate || ""),
    original_language,
    genres,
    casts: fallback.casts || [],
    averageRating: vote_average || 0,
    runtime: runtime || 0,
    numVotes: vote_count || 0,
  };

  await Movie.updateOne({ _id: id }, { $set: doc }, { upsert: true });
  return id;
}
