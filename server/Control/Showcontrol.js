// Purpose: Handle movie/show related endpoints.
// - Talk to TMDB to fetch movie metadata (now playing, single movie details).
// - Create/refresh Movie documents and create Show documents.
// - Provide search and listing endpoints used by the frontend.
// Keep logic focused: validate input, fetch/update DB, return consistent JSON.

import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../Inngest/index.js";
import mongoose from "mongoose";

const VERBOSE = process.env.VERBOSE_LOG === "1";

// Fetch now-playing movies from TMDB and return a small list for the frontend.
// We only return a slim set of fields (id, title, poster, ratings).
export const getnowplayingMovies = async (_req, res) => {
  try {
    const { data } = await axios.get(
      "https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1",
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_KEY}`,
          accept: "application/json",
        },
      }
    );

    const movies = (data?.results ?? [])
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        title: m.title,
        vote_average: m.vote_average,
        vote_count: m.vote_count,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
      }));

    return res.status(200).json({ success: true, movies });
  } catch (error) {
    // In non-production show the error in logs for debugging.
    if (process.env.NODE_ENV !== "production") console.error("getnowplayingMovies:", error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: error.message });
  }
};

// Add a show for a TMDB movie.
// - Fetches latest movie details, credits and videos from TMDB.
// - Upserts Movie document (refreshes trailer and casts).
// - Creates Show documents for the requested dates/times.
// - Triggers a background job to notify subscribers (Inngest).
export const addshow = async (req, res) => {
  try {
    // Basic debug/logging to help during development.
    if (VERBOSE) console.log("/api/admin/addshow called with body:", req.body);

    const { movieId, showsInput, showprice } = req.body;
    const movieIdStr = String(movieId);

    // Fetch movie details, credits and videos in parallel for speed.
    const [movieResp, creditsResp, videosResp] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/movie/${movieIdStr}`, {
        headers: { Authorization: `Bearer ${process.env.TMDB_KEY}` },
      }),
      axios.get(`https://api.themoviedb.org/3/movie/${movieIdStr}/credits`, {
        headers: { Authorization: `Bearer ${process.env.TMDB_KEY}` },
      }),
      axios.get(`https://api.themoviedb.org/3/movie/${movieIdStr}/videos`, {
        headers: { Authorization: `Bearer ${process.env.TMDB_KEY}` },
      }),
    ]);

    // Build a small cast array (limited to first 12 cast members)
    const m = movieResp.data;
    const casts = (creditsResp.data?.cast ?? []).slice(0, 12).map((c) => ({
      name: c.name,
      profile: c.profile_path ? `https://image.tmdb.org/t/p/w500${c.profile_path}` : "/fallbacks/no-cast.jpg",
    }));

    // Pick a trailer-like video (YouTube Trailer/Teaser/Clip/Featurette).
    const trailerData = (videosResp.data?.results ?? []).find(
      (v) => v.site === "YouTube" && ["Trailer", "Teaser", "Clip", "Featurette"].includes(v.type)
    );
    const trailer = trailerData ? `https://www.youtube.com/watch?v=${trailerData.key}` : "";

    // Upsert the Movie document and always refresh trailer & casts.
    // This keeps our local copy in sync with TMDB.
    const movie = await Movie.findOneAndUpdate(
      { tmdbId: movieIdStr },
      {
        $set: {
          tmdbId: String(m.id),
          originalTitle: m.original_title || m.title || "Untitled",
          description: m.overview || "",
          primaryImage: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
          thumbnails: m.backdrop_path ? [`https://image.tmdb.org/t/p/w500${m.backdrop_path}`] : [],
          trailer, // always refresh
          releaseDate: m.release_date || "",
          original_language: [m.original_language].filter(Boolean),
          genres: (m.genres || []).map((g) => g.name),
          casts, // always refresh
          averageRating: m.vote_average ?? null,
          runtime: m.runtime ?? null,
          numVotes: m.vote_count ?? null,
        },
      },
      { upsert: true, new: true }
    );

    // Prepare Show documents from input (date + time pairs)
    const docs = (showsInput ?? []).map(({ date, time }) => ({
      movie: movie._id,
      showDateTime: new Date(`${date}T${time}`),
      showprice: Number(showprice),
      occupiedSeats: {},
    }));

    // Insert shows if any were provided
    if (docs.length) await Show.insertMany(docs);

    // Inform background workers (email, analytics, etc.) about new show
    await inngest.send({ name: "app/show.added", data: { movieId: movie._id } });

    return res.status(200).json({ success: true, message: "Show(s) added successfully." });
  } catch (error) {
    // Always log errors on the server for diagnosis.
    console.error("addshow error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

// Return unique movies that have upcoming shows.
// We query upcoming shows, then deduplicate movies so frontend sees each movie once.
export const getmovies = async (_req, res) => {
  try {
    const shows = await Show.find({ showDateTime: { $gte: new Date() } })
      .populate("movie")
      .sort({ showDateTime: 1 })
      .lean();

    // Deduplicate movies
    const seen = new Set();
    const uniqueMovies = [];
    for (const s of shows) {
      if (s.movie) {
        const id = String(s.movie._id);
        if (!seen.has(id)) {
          seen.add(id);
          uniqueMovies.push(s.movie);
        }
      }
    }

    if (VERBOSE) console.log(`[RES] getmovies -> ${uniqueMovies.length} unique`);
    return res.status(200).json({ success: true, shows: uniqueMovies });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("getmovies error:", err);
    if (!res.headersSent) return res.status(500).json({ success: false, message: err.message });
  }
};

// Fetch a single movie and its upcoming show times.
// Accepts either a Mongo ObjectId or a TMDB id string as movieId parameter.
// If the movie has no trailer stored, fetch trailer from TMDB and save it.
export const getmovie = async (req, res) => {
  try {
    const movieIdStr = String(req.params.movieId);
    let movie = null;

    // Try treating param as ObjectId first, then fallback to tmdbId lookup
    if (mongoose.Types.ObjectId.isValid(movieIdStr)) {
      movie = await Movie.findById(movieIdStr).lean();
    }
    if (!movie) {
      movie = await Movie.findOne({ tmdbId: movieIdStr }).lean();
    }

    // If we don't have a trailer locally, try fetching it from TMDB
    if (movie && !movie.trailer) {
      const videosResp = await axios.get(
        `https://api.themoviedb.org/3/movie/${movie.tmdbId}/videos`,
        { headers: { Authorization: `Bearer ${process.env.TMDB_KEY}` } }
      );

      const trailerData = (videosResp.data?.results ?? []).find(
        (v) => v.site === "YouTube" && v.type === "Trailer"
      );

      if (trailerData) {
        const trailer = `https://www.youtube.com/watch?v=${trailerData.key}`;
        // Persist trailer so we don't fetch it repeatedly
        await Movie.updateOne({ _id: movie._id }, { $set: { trailer } });
        movie.trailer = trailer;
      }
    }

    if (!movie) {
      return res.status(404).json({ success: false, message: "Movie not found" });
    }

    // Find upcoming shows for that movie and group them by date for the frontend
    const shows = await Show.find({
      movie: movie._id,
      showDateTime: { $gte: new Date() },
    }).lean();

    const datetime = {};
    for (const s of shows) {
      const date = new Date(s.showDateTime).toISOString().split("T")[0];
      if (!datetime[date]) datetime[date] = [];
      datetime[date].push({ time: s.showDateTime, showId: s._id });
    }

    return res.status(200).json({ success: true, movie, datetime });
  } catch (error) {
    console.error("getmovie error:", error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: error.message });
  }
};

// Search shows using a natural language-like query.
// Supports dates (YYYY-MM-DD, today, tomorrow, weekdays), times (after/before), genre keywords, and price filters.
// Returns matched shows with applied filters summary so frontend can show what was applied.
export const searchShows = async (req, res) => {
  try {
    const q = String(req.query.q || "").toLowerCase().trim();

    // Default search window: now -> two weeks ahead
    const now = new Date();
    let from = new Date(now);
    let to = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
    let afterMin = null;
    let beforeMin = null;
    let maxPrice = null;

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const toMinutes = (h, m, ap) => {
      let hh = parseInt(h, 10);
      const mm = m ? parseInt(m, 10) : 0;
      if (ap) {
        const a = ap.toLowerCase();
        if (a === "pm" && hh !== 12) hh += 12;
        if (a === "am" && hh === 12) hh = 0;
      }
      return hh * 60 + mm;
    };

    // Parse explicit YYYY-MM-DD dates first
    const isoDateMatch = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoDateMatch) {
      const d = new Date(`${isoDateMatch[1]}T00:00:00`);
      from = new Date(d);
      from.setHours(0, 0, 0, 0);
      to = new Date(d);
      to.setHours(23, 59, 59, 999);
    } else {
      // Parse relative day words: today, tomorrow, or weekday names
      const dayMatch = q.match(
        /\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
      );
      if (dayMatch) {
        const word = dayMatch[1].toLowerCase();
        if (word === "today") {
          from = new Date();
          from.setHours(0, 0, 0, 0);
          to = new Date();
          to.setHours(23, 59, 59, 999);
        } else if (word === "tomorrow") {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          from = new Date(d);
          from.setHours(0, 0, 0, 0);
          to = new Date(d);
          to.setHours(23, 59, 59, 999);
        } else {
          const target = dayNames.indexOf(word);
          const d = new Date();
          const diff = (target - d.getDay() + 7) % 7;
          d.setDate(d.getDate() + diff);
          from = new Date(d);
          from.setHours(0, 0, 0, 0);
          to = new Date(d);
          to.setHours(23, 59, 59, 999);
        }
      }
    }

    // Parse time filters like "after 6pm" or "before 10am"
    const afterMatch = q.match(/\b(after|post|>=)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const beforeMatch = q.match(/\b(before|<=)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (afterMatch) afterMin = toMinutes(afterMatch[2], afterMatch[3], afterMatch[4]);
    if (beforeMatch) beforeMin = toMinutes(beforeMatch[2], beforeMatch[3], beforeMatch[4]);

    // Parse price filters (supports "under 500", "₹300", etc.)
    const priceMatch = q.match(/(?:under|below|less\s*than|<=|near)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})|(?:₹|rs\.?|inr)\s*(\d{2,5})/i);
    if (priceMatch) maxPrice = parseInt(priceMatch[1] || priceMatch[2], 10);

    // Base DB condition: shows between from and to
    const cond = { showDateTime: { $gte: from, $lte: to } };
    if (maxPrice != null) cond.showprice = { $lte: maxPrice };

    // Fetch candidate shows from DB
    let docs = await Show.find(cond).populate("movie").sort({ showDateTime: 1 }).lean();

    // Apply time-of-day filters in JS (after/before)
    docs = docs.filter((s) => {
      const dt = new Date(s.showDateTime);
      const mins = dt.getHours() * 60 + dt.getMinutes();
      if (afterMin != null && mins < afterMin) return false;
      if (beforeMin != null && mins > beforeMin) return false;
      return true;
    });

    // Genre filtering: check query for known genres and match movie genres
    const knownGenres = [
      "action","adventure","animation","comedy","crime","drama","family","fantasy",
      "history","horror","mystery","romance","science fiction","sci-fi","thriller","war","western",
    ];
    const wanted = knownGenres.filter((g) => q.includes(g));
    const normalize = (g) =>
      g === "sci-fi" || g === "science fiction"
        ? "Science Fiction"
        : g.replace(/\b\w/g, (c) => c.toUpperCase());
    if (wanted.length) {
      const set = new Set(wanted.map(normalize));
      docs = docs.filter((s) => (s.movie?.genres || []).some((gn) => set.has(gn)));
    }

    // Title / keyword matching: split query into tokens and match all tokens in title
    const titleTokens = q
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          ![
            "movie","movies","after","before","today","tomorrow","this","near","under","below",
            "less","than","pm","am",
          ].includes(w)
      );
    if (titleTokens.length) {
      docs = docs.filter((s) => {
        const title = (s.movie?.originalTitle || "").toLowerCase();
        return titleTokens.every((tok) => title.includes(tok));
      });
    }

    // Build simple result objects for the frontend
    const results = docs.map((s) => ({
      showId: s._id,
      showDateTime: s.showDateTime,
      showprice: s.showprice,
      movie: s.movie,
    }));

    return res.json({
      success: true,
      count: results.length,
      applied: {
        from,
        to,
        afterMin,
        beforeMin,
        maxPrice,
        genres: wanted.map(normalize),
      },
      results,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("searchShows:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};
