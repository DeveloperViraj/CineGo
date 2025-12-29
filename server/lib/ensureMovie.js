// Purpose: Ensure a movie exists in the database using a TMDB ID.
// If the movie already exists, it updates missing fields.
// If it does not exist, it fetches data from TMDB and creates it.
// This utility keeps movie creation logic reusable and consistent.

import axios from "axios";
import Movie from "../models/Movie.js";

// Main helper used before creating shows or bookings
// Returns the MongoDB _id of the movie
export async function ensureMovieByTmdb(tmdbId, fallback = {}) {
  const rawKey = process.env.TMDB_API_KEY || process.env.TMDB_KEY || "";
  const isV4 = rawKey.startsWith("ey"); // Detect TMDB v4 (Bearer) token

  // If no TMDB key and no fallback data, we cannot proceed
  if (!rawKey && !fallback.originalTitle) {
    throw new Error("TMDB_API_KEY missing and no fallback provided");
  }

  let details = null,
    videos = null,
    credits = null;

  // Fetch movie details, trailers, and credits from TMDB (if key exists)
  if (rawKey) {
    const headers = isV4 ? { Authorization: `Bearer ${rawKey}` } : {};
    const params = isV4
      ? { language: "en-US" }
      : { api_key: rawKey, language: "en-US" };

    const [d, v, c] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}`, { headers, params }),
      axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/videos`, { headers, params }),
      axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/credits`, { headers, params }),
    ]).catch((e) => {
      // If TMDB fails and no fallback exists, stop the flow
      if (!fallback.originalTitle) {
        throw new Error(`TMDB fetch failed: ${e.response?.status || e.message}`);
      }
      return [null, null, null];
    });

    details = d?.data || null;
    videos = v?.data || null;
    credits = c?.data || null;
  }

  // Convert TMDB + fallback data into our Movie schema format
  const mapped = mapToMovieDoc(tmdbId, details, videos, credits, fallback);

  // Upsert movie: create if missing, update if already exists
  const upserted = await Movie.findOneAndUpdate(
    { tmdbId: String(tmdbId) },
    { $set: mapped },
    { upsert: true, new: true }
  ).lean();

  return upserted._id;
}

// Maps external TMDB data into the internal Movie document structure
function mapToMovieDoc(tmdbId, details, videos, credits, fallback) {
  const title =
    details?.title ||
    details?.original_title ||
    fallback.originalTitle ||
    "Untitled";

  const posterUrl = details?.poster_path
    ? `https://image.tmdb.org/t/p/w780${details.poster_path}`
    : fallback.primaryImage || "";

  // Pick the best available trailer-type video from YouTube
  const trailerObj = videos?.results?.find(
    (v) =>
      v.site === "YouTube" &&
      ["Trailer", "Teaser", "Clip", "Featurette"].includes(v.type)
  );
  const trailerUrl = trailerObj?.key
    ? `https://www.youtube.com/watch?v=${trailerObj.key}`
    : "";

  // Map cast members (limit to top 12 for UI clarity)
  const castArr = credits?.cast
    ? credits.cast.slice(0, 12).map((c) => ({
        name: c.name,
        profile: c.profile_path
          ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
          : "/fallbacks/no-cast.jpg",
      }))
    : fallback.casts || [];

  return {
    tmdbId: String(tmdbId),
    originalTitle: title,
    description: details?.overview || fallback.description || "No description.",
    primaryImage: posterUrl,
    thumbnails: posterUrl ? [posterUrl] : [],
    trailer: trailerUrl,
    releaseDate: details?.release_date || fallback.releaseDate || "2025-01-01",
    original_language:
      details?.spoken_languages?.map((l) => l.english_name) ||
      fallback.original_language ||
      [],
    genres: details?.genres?.map((g) => g.name) || fallback.genres || [],
    casts: castArr,
    averageRating: details?.vote_average ?? 0,
    runtime: details?.runtime ?? 0,
    numVotes: details?.vote_count ?? 0,
  };
}

export default ensureMovieByTmdb;
