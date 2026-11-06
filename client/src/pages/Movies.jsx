import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCwIcon, XIcon } from 'lucide-react';
import BlurCircle from '../components/BlurCircle';
import MovieCard, { MovieCardSkeleton, movieGridClass } from '../components/MovieCard';
import { useAppContext } from '../context/Appcontext';
import { axios } from '../lib/api';
import { CURRENCY, formatDateLong } from '../lib/format';

const SORTS = {
  popular: { label: 'Popular', fn: () => 0 },
  rating: { label: 'Top rated', fn: (a, b) => (b.averageRating || 0) - (a.averageRating || 0) },
  newest: { label: 'Newest', fn: (a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)) },
  price: { label: 'Lowest price', fn: (a, b) => (a.minPrice || 0) - (b.minPrice || 0) },
};

// Client-side fallback if the search API is unreachable: match title/description words
function localFilter(shows, q) {
  const terms = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return shows.filter((m) => {
    const hay = `${m.originalTitle} ${m.description} ${(m.genres || []).join(' ')}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

const minutesLabel = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`;
};

const Movies = () => {
  const { shows, moviesLoading, bumpMovies } = useAppContext();
  const [params, setParams] = useSearchParams();
  const query = (params.get('query') || '').trim();
  const genre = params.get('genre') || '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'popular';

  // Natural-language search runs on the server (dates, times, prices, genres, titles)
  const [search, setSearch] = useState({ query: '', loading: false, movies: [], applied: null });
  const showsRef = useRef(shows);
  showsRef.current = shows;
  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setSearch({ query, loading: true, movies: [], applied: null });
    axios
      .get('/api/show/search', { params: { q: query } })
      .then(({ data }) => {
        if (cancelled) return;
        const seen = new Map();
        for (const r of data.results || []) {
          if (!r.movie?._id) continue;
          const prev = seen.get(r.movie._id);
          if (!prev) seen.set(r.movie._id, { ...r.movie, nextShow: r.showDateTime, minPrice: r.showprice });
          else if (r.showprice < prev.minPrice) prev.minPrice = r.showprice;
        }
        setSearch({ query, loading: false, movies: [...seen.values()], applied: data.applied });
      })
      .catch(() => {
        if (!cancelled) setSearch({ query, loading: false, movies: localFilter(showsRef.current, query), applied: null });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const genres = useMemo(() => {
    const count = new Map();
    shows.forEach((m) => (m.genres || []).forEach((g) => count.set(g, (count.get(g) || 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 12);
  }, [shows]);

  const list = useMemo(() => {
    let base = query ? search.movies : shows;
    if (genre) base = base.filter((m) => (m.genres || []).includes(genre));
    return sort === 'popular' ? base : [...base].sort(SORTS[sort].fn);
  }, [query, search.movies, shows, genre, sort]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const loading = query ? search.loading || search.query !== query : moviesLoading && !shows.length;
  const a = search.applied;
  const appliedChips = a
    ? [
        ...(a.genres || []),
        a.from && a.to && new Date(a.to) - new Date(a.from) < 2 * 864e5 ? formatDateLong(a.from) : null,
        a.afterMin != null ? `after ${minutesLabel(a.afterMin)}` : null,
        a.beforeMin != null ? `before ${minutesLabel(a.beforeMin)}` : null,
        a.maxPrice != null ? `under ${CURRENCY}${a.maxPrice}` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="relative min-h-[80vh] overflow-hidden px-6 pb-16 pt-28 md:px-8 lg:px-16 xl:px-20">
      <BlurCircle top="80px" right="-60px" />
      <BlurCircle top="500px" left="-80px" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-primary-dull">
            {query ? 'Search' : 'In cinemas'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
            {query ? <>Results for “{query}”</> : 'Now showing'}
          </h1>
          {appliedChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {appliedChips.map((c) => (
                <span key={c} className="rounded-full bg-primary/20 px-3 py-1 text-xs text-primary-dull">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {query && (
            <button
              onClick={() => setParam('query', '')}
              className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10"
            >
              <XIcon className="h-4 w-4" /> Clear search
            </button>
          )}
          <label className="sr-only" htmlFor="sort">Sort movies</label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setParam('sort', e.target.value === 'popular' ? '' : e.target.value)}
            className="rounded-full border border-white/15 bg-[#141317] px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-primary"
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {genres.length > 1 && (
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
          {['', ...genres].map((g) => (
            <button
              key={g || 'all'}
              onClick={() => setParam('genre', g)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                genre === g
                  ? 'border-primary bg-primary text-white'
                  : 'border-white/15 text-gray-300 hover:border-white/40 hover:text-white'
              }`}
            >
              {g || 'All'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={`${movieGridClass} mt-8`}>
          {Array.from({ length: 12 }, (_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center text-gray-300">
          <p className="text-lg">{query || genre ? 'No movies match that.' : 'No shows are on sale right now.'}</p>
          <p className="max-w-md text-sm text-gray-400">
            {query || genre
              ? 'Try another title, genre or day — e.g. “action this weekend”.'
              : 'New shows are scheduled automatically every day. Please try again in a moment.'}
          </p>
          <button
            onClick={() => (query || genre ? setParams({}, { replace: true }) : bumpMovies())}
            className="mt-2 flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium hover:bg-primary-dull"
          >
            <RefreshCwIcon className="h-4 w-4" /> {query || genre ? 'Show all movies' : 'Refresh'}
          </button>
        </div>
      ) : (
        <div className={`${movieGridClass} mt-8`}>
          {list.map((movie, i) => (
            <MovieCard key={movie._id} movie={movie} index={i} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Movies;
