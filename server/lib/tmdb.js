// Purpose: Single TMDB client used by the whole backend.
// - Supports both TMDB key styles: v4 "Bearer" read token (starts with "ey") and v3 api_key.
// - Fetches details + videos + credits in ONE request (append_to_response)
//   instead of three, which matters for the daily scheduler.
// - Maps TMDB data into our Movie schema in one consistent shape.

import axios from "axios";

const IMG = "https://image.tmdb.org/t/p";

function tmdbKey() {
  return (process.env.TMDB_KEY || process.env.TMDB_API_KEY || "").trim();
}

export const hasTmdbKey = () => !!tmdbKey();

const http = axios.create({
  baseURL: "https://api.themoviedb.org/3",
  timeout: 8000,
});

async function tmdbGet(path, params = {}) {
  const key = tmdbKey();
  if (!key) throw new Error("TMDB_KEY is not configured");
  const isV4 = key.startsWith("ey");
  const { data } = await http.get(path, {
    headers: isV4 ? { Authorization: `Bearer ${key}`, accept: "application/json" } : {},
    params: { language: "en-US", ...params, ...(isV4 ? {} : { api_key: key }) },
  });
  return data;
}

// Movies currently in cinemas. `region` (ISO 3166-1, e.g. "IN") narrows the list
// to what is actually playing in that country.
export async function getNowPlaying({ region = process.env.TMDB_REGION || "IN", pages = 2 } = {}) {
  const results = [];
  for (let page = 1; page <= pages; page++) {
    const data = await tmdbGet("/movie/now_playing", { page, ...(region ? { region } : {}) });
    results.push(...(data?.results || []));
    if (page >= (data?.total_pages || 1)) break;
  }
  // De-duplicate (TMDB pages can overlap while its index updates)
  const seen = new Set();
  return results.filter((m) => {
    if (!m?.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export async function getMovieFull(tmdbId) {
  return tmdbGet(`/movie/${tmdbId}`, { append_to_response: "videos,credits" });
}

export async function getMovieVideos(tmdbId) {
  return tmdbGet(`/movie/${tmdbId}/videos`);
}

export function pickTrailer(videos) {
  const list = (videos?.results || []).filter((v) => v.site === "YouTube" && v.key);
  const rank = { Trailer: 0, Teaser: 1, Clip: 2, Featurette: 3 };
  const best = list
    .filter((v) => v.type in rank)
    .sort((a, b) => rank[a.type] - rank[b.type] || Number(b.official) - Number(a.official))[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : "";
}

export const posterUrl = (path, size = "w500") => (path ? `${IMG}/${size}${path}` : "");

const languageName = (code) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
};

// Convert a TMDB "movie details" payload (ideally with videos + credits appended)
// into the fields stored on our Movie model.
export function mapTmdbMovie(m) {
  const poster = posterUrl(m.poster_path, "w500");
  const backdrop = posterUrl(m.backdrop_path, "w1280");

  // Cast is stored as { name, profile } everywhere (the movie page reads this shape)
  const casts = (m.credits?.cast || []).slice(0, 12).map((c) => ({
    name: c.name,
    character: c.character || "",
    profile: c.profile_path ? `${IMG}/w185${c.profile_path}` : "",
  }));

  const spoken = (m.spoken_languages || []).map((l) => l.english_name || l.name).filter(Boolean);
  const languages = spoken.length
    ? spoken
    : [m.original_language].filter(Boolean).map(languageName);

  const doc = {
    tmdbId: String(m.id),
    originalTitle: m.title || m.original_title || "Untitled",
    description: m.overview || "No description available.",
    primaryImage: poster || backdrop || "/fallback-image.jpg",
    thumbnails: [backdrop || poster].filter(Boolean),
    backdrop,
    tagline: m.tagline || "",
    trailer: pickTrailer(m.videos),
    releaseDate: m.release_date || "",
    original_language: languages,
    genres: (m.genres || []).map((g) => g.name),
    casts,
    averageRating: m.vote_average != null ? Math.round(m.vote_average * 10) / 10 : 0,
    runtime: m.runtime || 0,
    numVotes: m.vote_count || 0,
    popularity: m.popularity || 0,
    syncedAt: new Date(),
  };
  if (m.videos) doc.trailerCheckedAt = new Date();
  return doc;
}
