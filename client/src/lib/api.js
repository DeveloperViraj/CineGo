// Purpose: Shared API setup + the fast path for the movie list.
//
// Why movies used to appear late:
//   1. The request only started after React, Clerk and the whole app bundle had loaded.
//   2. Nothing was cached, so every visit waited for a full API round trip
//      (plus a server cold start on free hosting).
// Now:
//   - The request starts the moment this module is evaluated (in parallel with React/Clerk).
//   - The last list is kept in localStorage, so returning visitors see movies instantly
//     while a fresh copy loads in the background (stale-while-revalidate).

import axios from 'axios';

const base = (import.meta.env.VITE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/, '');
axios.defaults.baseURL = base;
axios.defaults.timeout = 25000;

const CACHE_KEY = 'cinego:movies:v2';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 3; // never show a list older than 3 days

export function readCachedMovies() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, shows } = JSON.parse(raw);
    if (!Array.isArray(shows) || Date.now() - at > CACHE_MAX_AGE) return null;
    return shows;
  } catch {
    return null;
  }
}

export function writeCachedMovies(shows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), shows }));
  } catch {
    /* storage full / private mode: ignore */
  }
}

let pending = null;

// Fetch the bookable movie list. Concurrent callers share one request.
export function fetchMovies({ fresh = false } = {}) {
  if (pending && !fresh) return pending;
  pending = axios
    .get('/api/show/getmovies')
    .then(({ data }) => {
      if (!data?.success) throw new Error(data?.message || 'Failed to load movies');
      const shows = (data.shows || []).filter((m) => m && m._id);
      writeCachedMovies(shows);
      return shows;
    })
    .finally(() => {
      setTimeout(() => {
        pending = null;
      }, 0);
    });
  return pending;
}

// Kick off the request immediately at startup
export const initialMoviesRequest = fetchMovies();
initialMoviesRequest.catch(() => {});

// TMDB images come in fixed sizes; pick a smaller one for cards/thumbnails.
export function tmdbImage(url, size = 'w342') {
  if (!url || typeof url !== 'string') return '/fallback-image.svg';
  return url.replace(/(image\.tmdb\.org\/t\/p\/)(w\d+|original)\//, `$1${size}/`);
}

export function youtubeId(url = '') {
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

export { axios };
