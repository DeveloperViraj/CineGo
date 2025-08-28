// server/lib/ensureMovie.js
import axios from "axios";
import Movie from "../models/Movie.js";

export async function ensureMovieByTmdb(tmdbId, fallback = {}) {
  const rawKey = process.env.TMDB_API_KEY || process.env.TMDB_KEY || "";
  const isV4 = rawKey.startsWith("ey");
  if (!rawKey) {
    if (!fallback.originalTitle) {
      throw new Error("TMDB_API_KEY missing and no fallback provided");
    }
  }

  let details = null;
  let videos = null;
  let credits = null;

  if (rawKey) {
    const headers = isV4 ? { Authorization: `Bearer ${rawKey}` } : {};
    const params = isV4 ? { language: "en-US" } : { api_key: rawKey, language: "en-US" };

    try {
      // run all requests in parallel
      const [d, v, c] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}`, { headers, params }),
        axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/videos`, { headers, params }),
        axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/credits`, { headers, params }),
      ]);
      details = d.data;
      videos = v.data;
      credits = c.data;
    } catch (e) {
      if (!fallback.originalTitle) {
        throw new Error(`TMDB fetch failed: ${e.response?.status || e.message}`);
      }
    }
  }

  const mapped = mapToMovieDoc(tmdbId, details, videos, credits, fallback);

  const upserted = await Movie.findOneAndUpdate(
    { _id: String(tmdbId) },
    { $set: mapped },
    { upsert: true, new: true }
  ).lean();

  return upserted._id;
}

function mapToMovieDoc(tmdbId, details, videos, credits, fallback) {
  const title = details?.title || details?.original_title || fallback.originalTitle || "Untitled";

  const posterUrl =
    details?.poster_path
      ? `https://image.tmdb.org/t/p/w780${details.poster_path}`
      : fallback.primaryImage || "";

  // pick official trailer if exists
  const trailerObj = videos?.results?.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );
  const trailerUrl = trailerObj ? `https://www.youtube.com/watch?v=${trailerObj.key}` : "";

  // map top 10 cast
  const castArr = credits?.cast
    ? credits.cast.slice(0, 10).map((c) => ({
        name: c.name,
        character: c.character,
        profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      }))
    : fallback.casts || [];

  return {
    _id: String(tmdbId),
    originalTitle: title,
    description: details?.overview || fallback.description || "No description.",
    primaryImage: posterUrl,
    thumbnails: posterUrl ? [posterUrl] : [],
    trailer: trailerUrl,
    releaseDate: details?.release_date || fallback.releaseDate || "2025-01-01",
    original_language: details?.spoken_languages?.map((l) => l.english_name) || [],
    genres: details?.genres?.map((g) => g.name) || [],
    casts: castArr,
    averageRating: details?.vote_average || 0,
    runtime: details?.runtime || 0,
    numVotes: details?.vote_count || 0,
  };
}

export default ensureMovieByTmdb;
