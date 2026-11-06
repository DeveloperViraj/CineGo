// Purpose: Keep the cinema stocked automatically — no manual weekly/monthly updates.
//
// Every run (daily cron + self-healing trigger from the API):
//   1. Reads what is currently in cinemas from TMDB "now playing" (region-aware, default India).
//   2. Upserts those movies (details, cast, trailer) — details are only re-fetched every few days.
//   3. Tops up a rolling window of shows (default 14 days ahead) at fixed daily time slots.
//      The write is idempotent: running it twice never creates duplicate shows.
//   4. Deletes old auto-generated shows that nobody booked (keeps the collection small).
//
// If TMDB is unreachable or the key is missing, it keeps scheduling the movies it already
// knows about, so there is always something bookable.
//
// All knobs are environment variables (see server/.env.example).

import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import Booking from "../models/Booking.js";
import SyncState from "../models/SyncState.js";
import { getNowPlaying, getMovieFull, mapTmdbMovie, hasTmdbKey } from "./tmdb.js";
import { invalidate } from "./cache.js";

const STATE_ID = "auto-schedule";
const DAY_MS = 24 * 60 * 60 * 1000;

const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export function scheduleConfig() {
  const slotPool = (process.env.AUTO_SHOW_TIMES || "09:30,12:15,15:00,18:00,21:00,22:45")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{2}:\d{2}$/.test(s))
    .sort();

  return {
    enabled: process.env.AUTO_SCHEDULE !== "0",
    movieCount: Math.max(1, int(process.env.AUTO_MOVIE_COUNT, 12)),
    days: Math.min(30, Math.max(1, int(process.env.AUTO_SCHEDULE_DAYS, 14))),
    slotPool: slotPool.length ? slotPool : ["12:00", "18:00"],
    slotsPerMovie: Math.max(1, int(process.env.AUTO_SLOTS_PER_MOVIE, 3)),
    basePrice: int(process.env.AUTO_SHOW_PRICE, 200),
    primeSurcharge: int(process.env.AUTO_PRIME_SURCHARGE, 50), // shows starting 17:00 or later
    weekendSurcharge: int(process.env.AUTO_WEEKEND_SURCHARGE, 50), // Fri, Sat, Sun
    tzOffset: /^[+-]\d{2}:\d{2}$/.test(process.env.SHOW_TZ_OFFSET || "")
      ? process.env.SHOW_TZ_OFFSET
      : "+05:30",
    region: process.env.TMDB_REGION ?? "IN",
    refreshDetailsMs: 3 * DAY_MS,
  };
}

// ---------- time helpers (cinema-local dates, independent of the server's timezone) ----------

const offsetMinutes = (tz) => {
  const sign = tz.startsWith("-") ? -1 : 1;
  const [h, m] = tz.slice(1).split(":").map(Number);
  return sign * (h * 60 + m);
};

// "YYYY-MM-DD" of `date` in the cinema's timezone
export const localDateString = (date, tz) =>
  new Date(date.getTime() + offsetMinutes(tz) * 60000).toISOString().slice(0, 10);

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Combine a cinema-local date and "HH:MM" into an absolute instant
export const toInstant = (ymd, hhmm, tz) => new Date(`${ymd}T${hhmm}:00${tz}`);

// Stable small hash so each movie always gets the same time slots
const hash = (s) => {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

// Spread a movie's slots evenly over the day, staggered between movies
export function slotsFor(key, c = scheduleConfig()) {
  const pool = c.slotPool;
  const count = Math.min(c.slotsPerMovie, pool.length);
  const step = Math.max(1, Math.floor(pool.length / count));
  const start = hash(key) % pool.length;
  const picked = new Set();
  for (let i = 0; i < count; i++) picked.add(pool[(start + i * step) % pool.length]);
  return [...picked].sort();
}

export function priceFor(ymd, hhmm, c = scheduleConfig()) {
  const weekday = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  let price = c.basePrice;
  if (parseInt(hhmm, 10) >= 17) price += c.primeSurcharge;
  if (weekday === 0 || weekday === 5 || weekday === 6) price += c.weekendSurcharge;
  return price;
}

// Run `fn` over `items` with at most `limit` in flight (gentle on TMDB rate limits)
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------- locking ----------

async function acquireLock(ms) {
  const now = new Date();
  try {
    const doc = await SyncState.findOneAndUpdate(
      { _id: STATE_ID, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
      { $set: { lockedUntil: new Date(now.getTime() + ms), lastRunAt: now } },
      { upsert: true, new: true }
    );
    return !!doc;
  } catch (err) {
    if (err?.code === 11000) return false; // someone else holds the lock
    throw err;
  }
}

export const getScheduleState = () => SyncState.findById(STATE_ID).lean();

// ---------- steps ----------

// Returns Movie docs (lean) to schedule, in display order.
async function resolveMovies(c) {
  if (hasTmdbKey()) {
    try {
      let list = await getNowPlaying({ region: c.region, pages: 3 });
      // Region lists can be thin; top up with the global list so the site never looks empty
      if (list.length < c.movieCount && c.region) {
        const ids = new Set(list.map((m) => m.id));
        const global = await getNowPlaying({ region: "", pages: 1 });
        list = [...list, ...global.filter((m) => !ids.has(m.id))];
      }

      const picked = list
        .filter((m) => m.poster_path && !m.adult)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, c.movieCount);

      if (picked.length) {
        const existing = await Movie.find({ tmdbId: { $in: picked.map((m) => String(m.id)) } })
          .select("tmdbId syncedAt runtime")
          .lean();
        const known = new Map(existing.map((e) => [e.tmdbId, e]));

        const docs = await mapLimit(picked, 4, async (m, rank) => {
          const prev = known.get(String(m.id));
          const stale =
            !prev ||
            !prev.runtime ||
            !prev.syncedAt ||
            Date.now() - new Date(prev.syncedAt).getTime() > c.refreshDetailsMs;

          let fields = {};
          if (stale) {
            try {
              fields = mapTmdbMovie(await getMovieFull(m.id));
            } catch (err) {
              if (!prev) {
                console.warn(`[auto-schedule] skip ${m.id}: ${err.message}`);
                return null;
              }
            }
          }

          return Movie.findOneAndUpdate(
            { tmdbId: String(m.id) },
            {
              $set: {
                ...fields,
                nowPlaying: true,
                nowPlayingRank: rank,
                popularity: m.popularity || 0,
                averageRating: Math.round((m.vote_average || 0) * 10) / 10,
                numVotes: m.vote_count || 0,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          ).lean();
        });

        const movies = docs.filter(Boolean);
        if (movies.length) {
          await Movie.updateMany(
            { nowPlaying: true, _id: { $nin: movies.map((m) => m._id) } },
            { $set: { nowPlaying: false, nowPlayingRank: 999 } }
          );
          return { movies, source: "tmdb" };
        }
      }
    } catch (err) {
      console.error("[auto-schedule] TMDB unavailable, using known movies:", err.message);
    }
  }

  // Fallback 1: what we last knew was playing
  let movies = await Movie.find({ nowPlaying: true })
    .sort({ nowPlayingRank: 1 })
    .limit(c.movieCount)
    .lean();

  // Fallback 2: anything that had shows in the last 30 days (e.g. added by an admin)
  if (!movies.length) {
    const recentIds = await Show.distinct("movie", {
      showDateTime: { $gte: new Date(Date.now() - 30 * DAY_MS) },
    });
    movies = await Movie.find({ _id: { $in: recentIds } })
      .sort({ averageRating: -1 })
      .limit(c.movieCount)
      .lean();
  }
  return { movies, source: "fallback" };
}

async function scheduleShows(movies, c) {
  const now = Date.now();
  const earliest = now + 20 * 60 * 1000; // never create a show that starts in < 20 minutes
  const today = localDateString(new Date(now), c.tzOffset);
  const ops = [];

  for (const movie of movies) {
    const slots = slotsFor(movie.tmdbId || String(movie._id), c);
    for (let d = 0; d < c.days; d++) {
      const ymd = addDays(today, d);
      for (const hhmm of slots) {
        const at = toInstant(ymd, hhmm, c.tzOffset);
        if (at.getTime() < earliest) continue;
        ops.push({
          updateOne: {
            filter: { movie: movie._id, showDateTime: at },
            update: {
              $setOnInsert: {
                movie: movie._id,
                showDateTime: at,
                showprice: priceFor(ymd, hhmm, c),
                occupiedSeats: {},
                autoGenerated: true,
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  if (!ops.length) return 0;
  const res = await Show.bulkWrite(ops, { ordered: false });
  return res?.upsertedCount || 0;
}

// Remove auto-generated shows that ended 2+ days ago and have no bookings
async function cleanupPastShows() {
  const cutoff = new Date(Date.now() - 2 * DAY_MS);
  const old = await Show.find({ autoGenerated: true, showDateTime: { $lt: cutoff } })
    .select("_id")
    .limit(5000)
    .lean();
  if (!old.length) return 0;

  const booked = new Set(
    (await Booking.distinct("show", { show: { $in: old.map((s) => s._id) } })).map(String)
  );
  const ids = old.filter((s) => !booked.has(String(s._id))).map((s) => s._id);
  if (!ids.length) return 0;
  const res = await Show.deleteMany({ _id: { $in: ids } });
  return res.deletedCount || 0;
}

// ---------- main entry ----------

export async function syncShows({ reason = "manual", force = false } = {}) {
  const c = scheduleConfig();
  if (!c.enabled && !force) return { skipped: "disabled (AUTO_SCHEDULE=0)" };
  if (!(await acquireLock(4 * 60 * 1000))) return { skipped: "already running" };

  const started = Date.now();
  try {
    const { movies, source } = await resolveMovies(c);
    const showsCreated = await scheduleShows(movies, c);
    const oldShowsRemoved = await cleanupPastShows();

    const result = {
      reason,
      source,
      movies: movies.length,
      titles: movies.slice(0, 20).map((m) => m.originalTitle),
      showsCreated,
      oldShowsRemoved,
      days: c.days,
      ms: Date.now() - started,
    };

    await SyncState.updateOne(
      { _id: STATE_ID },
      { $set: { lockedUntil: null, lastSuccessAt: new Date(), lastResult: result, lastError: null } }
    );
    invalidate("public:");
    console.log("[auto-schedule] done", JSON.stringify(result));
    return result;
  } catch (err) {
    await SyncState.updateOne(
      { _id: STATE_ID },
      { $set: { lockedUntil: null, lastError: err.message } }
    ).catch(() => {});
    console.error("[auto-schedule] failed:", err);
    throw err;
  }
}
