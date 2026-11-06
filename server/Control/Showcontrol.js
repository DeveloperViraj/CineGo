// Purpose: Handle movie/show related endpoints.
// - Public: list bookable movies, movie details + showtimes, natural-language search.
// - Admin: TMDB now-playing picker, add shows manually, trigger the automatic schedule.
//
// Performance notes:
// - Public lists are served from a short in-memory cache (lib/cache.js).
// - "Which movies have upcoming shows" is one indexed aggregation instead of
//   loading and populating every upcoming show document.

import mongoose from "mongoose";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import DemoShow from "../models/DemoShow.js";
import { inngest } from "../Inngest/index.js";
import { memo, invalidate } from "../lib/cache.js";
import {
  getNowPlaying,
  getMovieFull,
  getMovieVideos,
  mapTmdbMovie,
  pickTrailer,
  posterUrl,
  hasTmdbKey,
} from "../lib/tmdb.js";
import {
  syncShows,
  scheduleConfig,
  getScheduleState,
  toInstant,
  localDateString,
} from "../lib/autoSchedule.js";

const VERBOSE = process.env.VERBOSE_LOG === "1";
const HOUR = 60 * 60 * 1000;
const APP_TZ = () => process.env.APP_TIMEZONE || "Asia/Kolkata";

// Fields the movie cards / hero / search need (casts are only needed on the details page)
const LIST_FIELDS =
  "originalTitle description primaryImage backdrop trailer releaseDate genres original_language averageRating numVotes runtime tagline tmdbId nowPlaying nowPlayingRank popularity";

// ---------- self-healing schedule ----------
// The daily cron (Inngest / Vercel cron) is the main trigger. If it is not configured
// or a run was missed, the first visitor after that kicks off a refresh, so the
// catalog never runs dry.

let lastStaleCheck = 0;
let lastEmptyAttempt = 0;

async function ensureFreshSchedule(hasMovies) {
  if (!scheduleConfig().enabled) return false;

  if (!hasMovies) {
    // Nothing bookable at all: fill it now so this visitor sees movies (throttled)
    if (Date.now() - lastEmptyAttempt < 2 * 60 * 1000) return false;
    lastEmptyAttempt = Date.now();
    try {
      const result = await syncShows({ reason: "empty-catalog" });
      return !result?.skipped && result?.movies > 0;
    } catch {
      return false;
    }
  }

  if (Date.now() - lastStaleCheck < 15 * 60 * 1000) return false;
  lastStaleCheck = Date.now();

  const state = await getScheduleState().catch(() => null);
  const last = state?.lastSuccessAt ? new Date(state.lastSuccessAt).getTime() : 0;
  if (Date.now() - last < 26 * HOUR) return false;

  // Stale: refresh in the background (Inngest if available, otherwise in-process)
  inngest
    .send({ name: "app/shows.sync", data: { reason: "stale-catalog" } })
    .catch(() => syncShows({ reason: "stale-catalog" }).catch(() => {}));
  return false;
}

// ---------- public ----------

async function loadNowShowing() {
  const now = new Date();
  const stats = await Show.aggregate([
    { $match: { showDateTime: { $gte: now } } },
    {
      $group: {
        _id: "$movie",
        nextShow: { $min: "$showDateTime" },
        minPrice: { $min: "$showprice" },
        showCount: { $sum: 1 },
      },
    },
  ]);
  if (!stats.length) return [];

  const byId = new Map(stats.map((s) => [String(s._id), s]));
  const movies = await Movie.find({ _id: { $in: stats.map((s) => s._id) } })
    .select(LIST_FIELDS)
    .lean();

  return movies
    .map((m) => {
      const s = byId.get(String(m._id));
      return { ...m, nextShow: s.nextShow, minPrice: s.minPrice, showCount: s.showCount };
    })
    .sort(
      (a, b) =>
        Number(!!b.nowPlaying) - Number(!!a.nowPlaying) ||
        (a.nowPlayingRank ?? 999) - (b.nowPlayingRank ?? 999) ||
        (b.popularity || 0) - (a.popularity || 0) ||
        (b.averageRating || 0) - (a.averageRating || 0)
    );
}

// Return unique movies that have upcoming shows.
export const getmovies = async (_req, res) => {
  try {
    let movies = await memo("public:movies", 60 * 1000, loadNowShowing);

    if (await ensureFreshSchedule(movies.length > 0)) {
      invalidate("public:movies");
      movies = await memo("public:movies", 60 * 1000, loadNowShowing);
    }

    if (VERBOSE) console.log(`[RES] getmovies -> ${movies.length} unique`);
    // Browsers may reuse this for 30s and serve it stale while revalidating
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
    return res.status(200).json({ success: true, shows: movies });
  } catch (err) {
    console.error("getmovies error:", err);
    if (!res.headersSent) return res.status(500).json({ success: false, message: err.message });
  }
};

const dayKey = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // -> "YYYY-MM-DD"

async function loadMovieWithShows(movieIdStr) {
  let movie = null;
  if (mongoose.Types.ObjectId.isValid(movieIdStr)) {
    movie = await Movie.findById(movieIdStr).lean();
  }
  if (!movie) movie = await Movie.findOne({ tmdbId: movieIdStr }).lean();
  if (!movie) return null;

  // Look for a trailer once (never on every request like before)
  if (!movie.trailer && !movie.trailerCheckedAt && movie.tmdbId && hasTmdbKey()) {
    try {
      const trailer = pickTrailer(await getMovieVideos(movie.tmdbId));
      await Movie.updateOne({ _id: movie._id }, { $set: { trailer, trailerCheckedAt: new Date() } });
      movie.trailer = trailer;
    } catch (e) {
      if (VERBOSE) console.warn("trailer lookup failed:", e.message);
    }
  }

  const shows = await Show.find({ movie: movie._id, showDateTime: { $gte: new Date() } })
    .select("showDateTime showprice")
    .sort({ showDateTime: 1 })
    .lean();

  // Group by the cinema's local date (the old code grouped by UTC date, so late-night
  // shows in India could appear under the previous day)
  const datetime = {};
  for (const s of shows) {
    const key = dayKey(new Date(s.showDateTime));
    (datetime[key] ||= []).push({ time: s.showDateTime, showId: s._id, price: s.showprice });
  }
  return { movie, datetime };
}

// Fetch a single movie and its upcoming show times (accepts Mongo _id or TMDB id).
export const getmovie = async (req, res) => {
  try {
    const id = String(req.params.movieId);
    const data = await memo(`public:movie:${id}`, 30 * 1000, () => loadMovieWithShows(id));
    if (!data) return res.status(404).json({ success: false, message: "Movie not found" });

    res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=120");
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("getmovie error:", error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: error.message });
  }
};

// Search shows using a natural language-like query.
// Supports dates (YYYY-MM-DD, today, tomorrow, weekdays, "this weekend"), times
// (after/before 6pm), genres and price ("under 300").
export const searchShows = async (req, res) => {
  try {
    const q = String(req.query.q || "").toLowerCase().trim().slice(0, 120);
    const tz = scheduleConfig().tzOffset;
    const now = new Date();
    const today = localDateString(now, tz);
    const dayStart = (ymd) => toInstant(ymd, "00:00", tz);
    const dayEnd = (ymd) => new Date(toInstant(ymd, "23:59", tz).getTime() + 59999);
    const shift = (ymd, n) => {
      const d = new Date(`${ymd}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const weekdayOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

    let from = now;
    let to = new Date(now.getTime() + 14 * 24 * HOUR);
    let afterMin = null;
    let beforeMin = null;
    let maxPrice = null;

    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const toMinutes = (h, m, ap) => {
      let hh = parseInt(h, 10);
      const mm = m ? parseInt(m, 10) : 0;
      if (ap) {
        if (ap === "pm" && hh !== 12) hh += 12;
        if (ap === "am" && hh === 12) hh = 0;
      } else if (hh >= 1 && hh <= 9) {
        hh += 12; // "after 6" almost always means 6 PM at the movies
      }
      return hh * 60 + mm;
    };

    const iso = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    const dayWord = q.match(/\b(today|tonight|tomorrow|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (iso) {
      from = dayStart(iso[1]);
      to = dayEnd(iso[1]);
    } else if (dayWord) {
      const w = dayWord[1];
      if (w === "today" || w === "tonight") {
        to = dayEnd(today);
      } else if (w === "tomorrow") {
        from = dayStart(shift(today, 1));
        to = dayEnd(shift(today, 1));
      } else if (w === "weekend") {
        const toSat = (6 - weekdayOf(today) + 7) % 7;
        const sat = shift(today, toSat === 6 ? -1 : toSat); // on Sunday, "this weekend" = today
        from = new Date(Math.max(now.getTime(), dayStart(sat).getTime()));
        to = dayEnd(shift(sat, 1));
      } else {
        const ymd = shift(today, (dayNames.indexOf(w) - weekdayOf(today) + 7) % 7);
        from = new Date(Math.max(now.getTime(), dayStart(ymd).getTime()));
        to = dayEnd(ymd);
      }
    }
    if (from < now) from = now;
    if (/\btonight\b/.test(q) && afterMin == null) afterMin = 17 * 60;

    const after = q.match(/\b(?:after|post|from)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    const before = q.match(/\b(?:before|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (after) afterMin = toMinutes(after[1], after[2], after[3]);
    if (before) beforeMin = toMinutes(before[1], before[2], before[3]);

    const price = q.match(/(?:under|below|less\s*than|upto|up\s*to|max)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})|(?:₹|rs\.?\s*|inr\s*)(\d{2,5})/);
    if (price) maxPrice = parseInt(price[1] || price[2], 10);

    const cond = { showDateTime: { $gte: from, $lte: to } };
    if (maxPrice != null) cond.showprice = { $lte: maxPrice };

    let docs = await Show.find(cond)
      .select("movie showDateTime showprice")
      .populate("movie", LIST_FIELDS)
      .sort({ showDateTime: 1 })
      .limit(1500)
      .lean();

    // Time-of-day filter in the cinema's timezone
    const tzMin = (() => {
      const sign = tz.startsWith("-") ? -1 : 1;
      const [h, m] = tz.slice(1).split(":").map(Number);
      return sign * (h * 60 + m);
    })();
    docs = docs.filter((s) => {
      const d = new Date(new Date(s.showDateTime).getTime() + tzMin * 60000);
      const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
      if (afterMin != null && mins < afterMin) return false;
      if (beforeMin != null && mins > beforeMin) return false;
      return true;
    });

    const knownGenres = [
      "action", "adventure", "animation", "comedy", "crime", "documentary", "drama", "family",
      "fantasy", "history", "horror", "music", "mystery", "romance", "science fiction", "sci-fi",
      "thriller", "war", "western",
    ];
    const wanted = knownGenres.filter((g) => new RegExp(`\\b${g}\\b`).test(q));
    const normalize = (g) =>
      g === "sci-fi" || g === "science fiction" ? "Science Fiction" : g.replace(/\b\w/g, (c) => c.toUpperCase());
    if (wanted.length) {
      const set = new Set(wanted.map(normalize));
      docs = docs.filter((s) => (s.movie?.genres || []).some((gn) => set.has(gn)));
    }

    // Remaining words must appear in the title (all filter words above are ignored)
    const ignore = new Set([
      "movie", "movies", "film", "films", "show", "shows", "showing", "after", "before", "today",
      "tonight", "tomorrow", "this", "next", "near", "under", "below", "less", "than", "upto", "max",
      "from", "post", "till", "until", "and", "the", "for", "with", "weekend", "rupees", "inr",
      ...dayNames, ...knownGenres.flatMap((g) => g.split(/[\s-]/)),
    ]);
    // Strip the date/time/price phrases we already understood, keep the rest (e.g. "avatar 3")
    let rest = q;
    for (const m of [iso, after, before, price]) if (m) rest = rest.replace(m[0], " ");
    const titleTokens = rest
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w && !ignore.has(w) && (w.length > 2 || /^\d+$/.test(w)) && !/^\d+(am|pm)$/.test(w));
    if (titleTokens.length) {
      docs = docs.filter((s) => {
        const title = (s.movie?.originalTitle || "").toLowerCase();
        return titleTokens.every((tok) => title.includes(tok));
      });
    }

    const results = docs
      .filter((s) => s.movie)
      .map((s) => ({ showId: s._id, showDateTime: s.showDateTime, showprice: s.showprice, movie: s.movie }));

    return res.json({
      success: true,
      count: results.length,
      applied: { from, to, afterMin, beforeMin, maxPrice, genres: wanted.map(normalize), titleTokens },
      results,
    });
  } catch (e) {
    console.error("searchShows:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- admin ----------

// Movies in cinemas right now (TMDB), flagged when they already have upcoming shows.
export const getnowplayingMovies = async (_req, res) => {
  try {
    const list = await memo("admin:nowplaying", 10 * 60 * 1000, async () => {
      const raw = await getNowPlaying({ region: scheduleConfig().region, pages: 2 });
      return raw.filter((m) => m.poster_path).slice(0, 30);
    });

    const scheduledIds = await Show.distinct("movie", { showDateTime: { $gte: new Date() } });
    const scheduledTmdb = new Set(
      (await Movie.find({ _id: { $in: scheduledIds } }).select("tmdbId").lean()).map((m) => m.tmdbId)
    );

    const movies = list.map((m) => ({
      id: m.id,
      title: m.title,
      vote_average: Math.round((m.vote_average || 0) * 10) / 10,
      vote_count: m.vote_count,
      release_date: m.release_date,
      poster: posterUrl(m.poster_path, "w342"),
      scheduled: scheduledTmdb.has(String(m.id)),
    }));
    return res.status(200).json({ success: true, movies });
  } catch (error) {
    console.error("getnowplayingMovies:", error.message);
    if (!res.headersSent) return res.status(500).json({ success: false, message: error.message });
  }
};

// Parse admin show input. Prefers an absolute ISO `dateTime` (computed in the admin's
// browser). Legacy `{date, time}` pairs are read in the cinema's timezone — the old code
// used the *server's* timezone, which on Vercel (UTC) shifted every show by 5h30m.
function parseShowTimes(showsInput, tz) {
  return (Array.isArray(showsInput) ? showsInput : [])
    .slice(0, 300)
    .map((s) => {
      if (s?.dateTime) return new Date(s.dateTime);
      if (s?.date && s?.time) return toInstant(String(s.date), String(s.time).slice(0, 5), tz);
      return null;
    })
    .filter((d) => d && !Number.isNaN(d.getTime()));
}

// Add shows for a TMDB movie (manual admin flow).
export const addshow = async (req, res) => {
  try {
    if (VERBOSE) console.log("/api/show/add body:", req.body);
    const { movieId, showsInput } = req.body || {};
    const price = Number(req.body?.showprice);
    const movieIdStr = String(movieId || "");

    if (!/^\d+$/.test(movieIdStr)) {
      return res.status(400).json({ success: false, message: "Select a movie" });
    }
    if (!Number.isFinite(price) || price <= 0 || price > 10000) {
      return res.status(400).json({ success: false, message: "Enter a valid ticket price" });
    }

    const now = Date.now();
    const times = parseShowTimes(showsInput, scheduleConfig().tzOffset).filter(
      (d) => d.getTime() > now
    );
    if (!times.length) {
      return res.status(400).json({ success: false, message: "Add at least one future date & time" });
    }

    const existing = await Movie.findOne({ tmdbId: movieIdStr }).select("_id").lean();
    const hadUpcoming = existing
      ? !!(await Show.exists({ movie: existing._id, showDateTime: { $gte: new Date() } }))
      : false;

    const fields = mapTmdbMovie(await getMovieFull(movieIdStr));
    const movie = await Movie.findOneAndUpdate(
      { tmdbId: movieIdStr },
      { $set: fields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    // Demo admins get private sandbox shows — they never touch the public catalog
    if (req.roles?.demo) {
      const created = await DemoShow.insertMany(
        times.map((t) => ({
          movie: String(movie._id),
          showDateTime: t,
          showprice: price,
          occupiedSeats: {},
          isDemo: true,
          demoOwner: req.userId,
        }))
      );
      return res.json({ success: true, mode: "demo", message: `${created.length} demo show(s) added (visible only to you)` });
    }

    // Upsert so re-adding the same time doesn't create duplicates
    const result = await Show.bulkWrite(
      times.map((t) => ({
        updateOne: {
          filter: { movie: movie._id, showDateTime: t },
          update: {
            $setOnInsert: { movie: movie._id, showDateTime: t, occupiedSeats: {}, autoGenerated: false },
            $set: { showprice: price },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    invalidate("public:");

    // Announce only genuinely new movies (not every extra showtime)
    if (!hadUpcoming && process.env.NEW_MOVIE_EMAILS !== "0") {
      inngest
        .send({ name: "app/show.added", data: { movieId: String(movie._id) } })
        .catch((e) => console.warn("Inngest show.added send failed:", e.message));
    }

    const created = result?.upsertedCount || 0;
    const updated = times.length - created;
    return res.status(200).json({
      success: true,
      mode: "public",
      message: `${created} show(s) added${updated ? `, ${updated} existing updated` : ""}.`,
    });
  } catch (error) {
    console.error("addshow error:", error);
    if (!res.headersSent) {
      const status = error.response?.status === 404 ? 404 : 500;
      return res.status(status).json({
        success: false,
        message: status === 404 ? "Movie not found on TMDB" : error.message,
      });
    }
  }
};

// Run the automatic schedule now (admin button) and report what happened.
export const runAutoSchedule = async (_req, res) => {
  try {
    const result = await syncShows({ reason: "admin", force: true });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const autoScheduleStatus = async (_req, res) => {
  try {
    const state = await getScheduleState();
    const c = scheduleConfig();
    return res.json({
      success: true,
      status: {
        enabled: c.enabled,
        days: c.days,
        movieCount: c.movieCount,
        slots: c.slotPool,
        region: c.region,
        lastSuccessAt: state?.lastSuccessAt || null,
        lastRunAt: state?.lastRunAt || null,
        lastResult: state?.lastResult || null,
        lastError: state?.lastError || null,
        tmdbConfigured: hasTmdbKey(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
