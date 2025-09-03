// Control/Showcontrol.js
import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../Inngest/index.js";
import mongoose from "mongoose";

const VERBOSE = process.env.VERBOSE_LOG === "1";

// Fetch now-playing movies from TMDB
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

    const movies = (data?.results ?? []).slice(0, 10).map((m) => ({
      id: m.id,
      title: m.title,
      vote_average: m.vote_average,
      vote_count: m.vote_count,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : "",
    }));

    return res.status(200).json({ success: true, movies });
  } catch (error) {
    if (process.env.NODE_ENV !== "production")
      console.error("getnowplayingMovies:", error);
    if (!res.headersSent)
      return res.status(500).json({ success: false, message: error.message });
  }
};

// Add a show for a TMDB movie
export const addshow = async (req, res) => {
  try {

    const { movieId, showsInput, showprice } = req.body;
    const movieIdStr = String(movieId);

    // Always fetch latest details (refresh trailers + casts)
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
    console.log("🎬 TMDB videos for", movieIdStr, ":", videosResp.data);


    const m = movieResp.data;

    const casts = (creditsResp.data?.cast ?? []).slice(0, 12).map((c) => ({
      name: c.name,
      profile: c.profile_path
        ? `https://image.tmdb.org/t/p/w500${c.profile_path}`
        : "/fallbacks/no-cast.jpg",
    }));

    const trailerData = (videosResp.data?.results ?? []).find(
      (v) =>
        v.site === "YouTube" &&
        ["Trailer", "Teaser", "Clip", "Featurette"].includes(v.type)
    );
    const trailer = trailerData
      ? `https://www.youtube.com/watch?v=${trailerData.key}`
      : "";

    // ✅ Upsert movie (ensures trailer + cast are always updated)
    const movie = await Movie.findOneAndUpdate(
      { tmdbId: movieIdStr },
      {
        $set: {
          tmdbId: String(m.id),
          originalTitle: m.original_title || m.title || "Untitled",
          description: m.overview || "",
          primaryImage: m.poster_path
            ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
            : "",
          thumbnails: m.backdrop_path
            ? [`https://image.tmdb.org/t/p/w500${m.backdrop_path}`]
            : [],
          trailer,
          releaseDate: m.release_date || "",
          original_language: [m.original_language].filter(Boolean),
          genres: (m.genres || []).map((g) => g.name),
          casts,
          averageRating: m.vote_average ?? null,
          runtime: m.runtime ?? null,
          numVotes: m.vote_count ?? null,
        },
      },
      { upsert: true, new: true }
    );

    // create shows
    const docs = (showsInput ?? []).map(({ date, time }) => ({
      movie: movie._id,
      showDateTime: new Date(`${date}T${time}`),
      showprice: Number(showprice),
      occupiedSeats: {},
    }));
    if (docs.length) await Show.insertMany(docs);

    // trigger email notification
    await inngest.send({ name: "app/show.added", data: { movieId: movie._id } });

    return res
      .status(200)
      .json({ success: true, message: "Show(s) added successfully." });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("addshow:", error);
    if (!res.headersSent)
      return res.status(500).json({ success: false, message: error.message });
  }
};

// Fetch all movies with upcoming shows
export const getmovies = async (_req, res) => {
  try {
    const shows = await Show.find({ showDateTime: { $gte: new Date() } })
      .populate("movie")
      .sort({ showDateTime: 1 })
      .lean();

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

    if (VERBOSE)
      console.log(`[RES] getmovies -> ${uniqueMovies.length} unique`);
    return res.status(200).json({ success: true, shows: uniqueMovies });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("getmovies error:", err);
    if (!res.headersSent)
      return res.status(500).json({ success: false, message: err.message });
  }
};

// Fetch single movie and its shows
export const getmovie = async (req, res) => {
  try {
    const movieIdStr = String(req.params.movieId);

    let movie = null;

    if (mongoose.Types.ObjectId.isValid(movieIdStr)) {
      movie = await Movie.findById(movieIdStr).lean();
    }

    if (!movie) {
      movie = await Movie.findOne({ tmdbId: movieIdStr }).lean();
    }

    if (!movie) {
      return res
        .status(404)
        .json({ success: false, message: "Movie not found" });
    }

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
    if (process.env.NODE_ENV !== "production") console.error("getmovie:", error);
    if (!res.headersSent)
      return res.status(500).json({ success: false, message: error.message });
  }
};


// Search shows (by date, time, genre, price, keywords)
export const searchShows = async (req, res) => {
  try {
    const q = String(req.query.q || "").toLowerCase().trim();

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

    // explicit YYYY-MM-DD
    const isoDateMatch = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoDateMatch) {
      const d = new Date(`${isoDateMatch[1]}T00:00:00`);
      from = new Date(d);
      from.setHours(0, 0, 0, 0);
      to = new Date(d);
      to.setHours(23, 59, 59, 999);
    } else {
      // relative words
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

    // times
    const afterMatch = q.match(
      /\b(after|post|>=)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
    );
    const beforeMatch = q.match(
      /\b(before|<=)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
    );
    if (afterMatch)
      afterMin = toMinutes(afterMatch[2], afterMatch[3], afterMatch[4]);
    if (beforeMatch)
      beforeMin = toMinutes(beforeMatch[2], beforeMatch[3], beforeMatch[4]);

    const priceMatch = q.match(
      /(?:under|below|less\s*than|<=|near)\s*(?:₹|rs\.?|inr)?\s*(\d{2,5})|(?:₹|rs\.?|inr)\s*(\d{2,5})/i
    );
    if (priceMatch) maxPrice = parseInt(priceMatch[1] || priceMatch[2], 10);

    const cond = { showDateTime: { $gte: from, $lte: to } };
    if (maxPrice != null) cond.showprice = { $lte: maxPrice };

    let docs = await Show.find(cond)
      .populate("movie")
      .sort({ showDateTime: 1 })
      .lean();

    docs = docs.filter((s) => {
      const dt = new Date(s.showDateTime);
      const mins = dt.getHours() * 60 + dt.getMinutes();
      if (afterMin != null && mins < afterMin) return false;
      if (beforeMin != null && mins > beforeMin) return false;
      return true;
    });

    const knownGenres = [
      "action",
      "adventure",
      "animation",
      "comedy",
      "crime",
      "drama",
      "family",
      "fantasy",
      "history",
      "horror",
      "mystery",
      "romance",
      "science fiction",
      "sci-fi",
      "thriller",
      "war",
      "western",
    ];
    const wanted = knownGenres.filter((g) => q.includes(g));
    const normalize = (g) =>
      g === "sci-fi" || g === "science fiction"
        ? "Science Fiction"
        : g.replace(/\b\w/g, (c) => c.toUpperCase());
    if (wanted.length) {
      const set = new Set(wanted.map(normalize));
      docs = docs.filter((s) =>
        (s.movie?.genres || []).some((gn) => set.has(gn))
      );
    }

    const titleTokens = q
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          ![
            "movie",
            "movies",
            "after",
            "before",
            "today",
            "tomorrow",
            "this",
            "near",
            "under",
            "below",
            "less",
            "than",
            "pm",
            "am",
          ].includes(w)
      );
    if (titleTokens.length) {
      docs = docs.filter((s) => {
        const title = (s.movie?.originalTitle || "").toLowerCase();
        return titleTokens.every((tok) => title.includes(tok));
      });
    }

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
