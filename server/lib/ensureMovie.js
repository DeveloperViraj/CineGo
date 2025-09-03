// server/lib/ensureMovie.js
import axios from "axios";
import Movie from "../models/Movie.js";

export async function ensureMovieByTmdb(tmdbId, fallback = {}) {
  const rawKey = process.env.TMDB_API_KEY || process.env.TMDB_KEY || "";
  const isV4 = rawKey.startsWith("ey");

  if (!rawKey && !fallback.originalTitle) {
    throw new Error("TMDB_API_KEY missing and no fallback provided");
  }

  let details = null,
    videos = null,
    credits = null;

  if (rawKey) {
    const headers = isV4 ? { Authorization: `Bearer ${rawKey}` } : {};
    const params = isV4 ? { language: "en-US" } : { api_key: rawKey, language: "en-US" };

    const [d, v, c] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}`, { headers, params }),
      axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/videos`, { headers, params }),
      axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/credits`, { headers, params }),
    ]).catch((e) => {
      if (!fallback.originalTitle) {
        throw new Error(`TMDB fetch failed: ${e.response?.status || e.message}`);
      }
      return [null, null, null];
    });

    details = d?.data || null;
    videos = v?.data || null;
    credits = c?.data || null;
  }

  const mapped = mapToMovieDoc(tmdbId, details, videos, credits, fallback);

  const upserted = await Movie.findOneAndUpdate(
    { tmdbId: String(tmdbId) },   // ✅ query by tmdbId
    { $set: mapped },
    { upsert: true, new: true }
  ).lean();

  return upserted._id;
}

function mapToMovieDoc(tmdbId, details, videos, credits, fallback) {
  const title =
    details?.title ||
    details?.original_title ||
    fallback.originalTitle ||
    "Untitled";

  const posterUrl = details?.poster_path
    ? `https://image.tmdb.org/t/p/w780${details.poster_path}`
    : fallback.primaryImage || "";

  const trailerObj = videos?.results?.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );
  const trailerUrl = trailerObj?.key
    ? `https://www.youtube.com/watch?v=${trailerObj.key}`
    : "";

  // ✅ Unified cast schema
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
