import axios from "axios";
import Movie from "../models/Movie.js";

/**
 * Ensure a Movie doc exists for a given TMDB id.
 * Supports either:
 *  - v3 key via TMDB_API_KEY (or TMDB_KEY if it looks like v3)
 *  - v4 Bearer token via TMDB_KEY or TMDB_API_KEY (if value starts with 'ey')
 *
 * If no key is available, uses the `fallback` object provided by the caller.
 *
 * @param {string|number} tmdbId
 * @param {object} fallback minimal fields if no TMDB key is configured
 * @returns {Promise<string>} Movie._id (string)
 */
export async function ensureMovieByTmdb(tmdbId, fallback = {}) {
  const rawKey =
    process.env.TMDB_API_KEY ||
    process.env.TMDB_KEY || // allow your current env name
    "";

  // Decide auth style
  const isV4 = rawKey && rawKey.startsWith("ey"); // TMDB v4 token looks like a JWT
  const hasKey = Boolean(rawKey);

  let data = null;

  if (hasKey) {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}`;
    try {
      if (isV4) {
        // v4: Bearer token
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${rawKey}` },
          params: { language: "en-US" },
        });
        data = res.data;
      } else {
        // v3: api_key query param
        const res = await axios.get(url, {
          params: { api_key: rawKey, language: "en-US" },
        });
        data = res.data;
      }
    } catch (e) {
      // If TMDB call fails but we have a fallback, we'll use it below
      if (!fallback || !fallback.originalTitle) {
        throw new Error(
          `TMDB fetch failed and no fallback provided: ${e.response?.status || e.message}`
        );
      }
    }
  } else {
    // No key at all → must have fallback
    if (!fallback || !fallback.originalTitle) {
      throw new Error("TMDB_API_KEY missing and no fallback provided");
    }
  }

  // Map TMDB (or fallback) → our schema
  const mapped = mapToMovieDoc(tmdbId, data, fallback);

  // Upsert into our Movies (note: your Movie._id is a string)
  const upserted = await Movie.findOneAndUpdate(
    { _id: String(tmdbId) },
    { $set: mapped },
    { upsert: true, new: true }
  ).lean();

  return upserted._id; // string
}

function mapToMovieDoc(tmdbId, tmdb, fallback = {}) {
  const title =
    tmdb?.title ||
    tmdb?.original_title ||
    fallback.originalTitle ||
    "Untitled";

  const posterPath =
    tmdb?.poster_path ||
    (fallback.primaryImage?.startsWith("/")
      ? fallback.primaryImage
      : null);

  const posterUrl =
    fallback.primaryImage ||
    (posterPath ? `https://image.tmdb.org/t/p/w780${posterPath}` : "");

  const release =
    tmdb?.release_date || fallback.releaseDate || "2025-01-01";

  return {
    _id: String(tmdbId), // you designed _id to be the TMDB id string
    originalTitle: title,
    description:
      tmdb?.overview || fallback.description || "No description.",
    primaryImage: posterUrl || "",
    thumbnails: posterUrl ? [posterUrl] : [],
    trailer: "",

    releaseDate: release,

    original_language: tmdb?.spoken_languages
      ? tmdb.spoken_languages.map((l) => l.english_name || l.name)
      : fallback.original_language || [],

    genres: tmdb?.genres
      ? tmdb.genres.map((g) => g.name)
      : fallback.genres || [],

    casts: fallback.casts || [],

    averageRating:
      typeof tmdb?.vote_average === "number"
        ? tmdb.vote_average
        : fallback.averageRating || 0,

    runtime:
      tmdb?.runtime || fallback.runtime || 0,

    numVotes:
      typeof tmdb?.vote_count === "number"
        ? tmdb.vote_count
        : fallback.numVotes || 0,
  };
}

export default ensureMovieByTmdb;
