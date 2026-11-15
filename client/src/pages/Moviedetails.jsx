import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarIcon, ClockIcon, Heart, PlayCircleIcon, Star, TicketIcon } from 'lucide-react';
import BlurCircle from '../components/BlurCircle';
import DateSelect from '../components/DateSelect';
import MovieCard, { movieGridClass } from '../components/MovieCard';
import TrailerModal from '../components/TrailerModal';
import { useAppContext } from '../context/Appcontext';
import { axios, tmdbImage } from '../lib/api';
import { compactNumber, formatRuntime, languageLabel, releaseYear } from '../lib/format';

const Moviedetails = () => {
  const { shows, favorites, toggleFavorite } = useAppContext();
  const { id } = useParams();
  const [details, setDetails] = useState({ id: null, movie: null, datetime: {} });
  const [notFound, setNotFound] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    axios
      .get(`/api/show/getmovie/${id}`)
      .then(({ data }) => {
        if (!cancelled && data.success) setDetails({ id, movie: data.movie, datetime: data.datetime || {} });
      })
      .catch((err) => {
        if (!cancelled && err?.response?.status === 404) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Render immediately from the cached list while the full details load
  const fromList = shows.find((m) => m._id === id);
  const loaded = details.id === id;
  const movie = (loaded && details.movie) || fromList;

  const similar = useMemo(() => {
    if (!movie) return [];
    const g = new Set(movie.genres || []);
    return shows
      .filter((m) => m._id !== movie._id)
      .map((m) => ({ m, score: (m.genres || []).filter((x) => g.has(x)).length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.m);
  }, [shows, movie]);

  if (notFound) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 pt-24 text-center">
        <p className="text-2xl font-semibold">Movie not found</p>
        <p className="text-gray-400">It may no longer be showing.</p>
        <Link to="/movies" className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-medium hover:bg-primary-dull">
          Browse movies
        </Link>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="px-6 pt-32 md:px-16 lg:px-24">
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="skeleton mx-auto aspect-[2/3] w-60 rounded-xl md:mx-0 md:w-80" />
          <div className="flex-1 space-y-4">
            <div className="skeleton h-10 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="skeleton h-24 w-full max-w-xl rounded" />
          </div>
        </div>
      </div>
    );
  }

  const isFaved = favorites?.some((m) => m?._id === movie._id);
  const casts = (loaded && Array.isArray(details.movie?.casts) ? details.movie.casts : []).slice(0, 12);
  const language = languageLabel(movie.original_language);

  return (
    <div className="relative">
      {/* Backdrop banner */}
      {movie.backdrop && (
        <div className="absolute inset-x-0 top-0 -z-10 h-[70vh] overflow-hidden">
          <img src={tmdbImage(movie.backdrop, 'w1280')} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/40 via-[#09090B]/80 to-[#09090B]" />
        </div>
      )}

      <div className="px-6 pb-12 pt-28 md:px-12 lg:px-20 xl:px-28">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-12">
          <img
            src={tmdbImage(movie.primaryImage, 'w500')}
            alt={`${movie.originalTitle} poster`}
            className="aspect-[2/3] w-60 shrink-0 rounded-xl object-cover shadow-2xl ring-1 ring-white/10 md:w-80"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/fallback-image.svg';
            }}
          />

          <div className="relative flex max-w-2xl flex-col gap-4">
            <BlurCircle top="-40px" left="-60px" />
            {language && <p className="text-sm font-medium uppercase tracking-wider text-primary-dull">{language}</p>}
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">{movie.originalTitle}</h1>
            {movie.tagline && <p className="text-lg italic text-gray-300">{movie.tagline}</p>}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-300">
              {movie.averageRating > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <b className="text-white">{Number(movie.averageRating).toFixed(1)}</b>
                  {movie.numVotes ? <span className="text-gray-400">({compactNumber(movie.numVotes)} votes)</span> : null}
                </span>
              )}
              {movie.runtime > 0 && (
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4" /> {formatRuntime(movie.runtime)}
                </span>
              )}
              {releaseYear(movie.releaseDate) && (
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4" /> {releaseYear(movie.releaseDate)}
                </span>
              )}
            </div>

            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {movie.genres.map((g) => (
                  <Link
                    key={g}
                    to={`/movies?genre=${encodeURIComponent(g)}`}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-300 hover:border-primary hover:text-white"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            <p className="leading-relaxed text-gray-300">{movie.description}</p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a
                href="#dates"
                className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium transition hover:bg-primary-dull"
              >
                <TicketIcon className="h-5 w-5" /> Buy tickets
              </a>
              {movie.trailer && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 font-medium transition hover:bg-white/20"
                >
                  <PlayCircleIcon className="h-5 w-5" /> Watch trailer
                </button>
              )}
              <button
                className={`rounded-full p-3 transition ${isFaved ? 'bg-primary/20' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={() => toggleFavorite(movie)}
                aria-label={isFaved ? 'Remove from favourites' : 'Add to favourites'}
                aria-pressed={isFaved}
                title={isFaved ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Heart className={`h-5 w-5 ${isFaved ? 'fill-primary text-primary' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <DateSelect datetime={loaded ? details.datetime : {}} id={id} loading={!loaded} />

        {(casts.length > 0 || !loaded) && (
          <section className="pt-16">
            <h2 className="text-lg font-semibold">Cast</h2>
            <div className="no-scrollbar mt-5 flex gap-5 overflow-x-auto pb-2">
              {!loaded
                ? Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="flex w-20 shrink-0 flex-col items-center gap-2">
                      <div className="skeleton h-20 w-20 rounded-full" />
                      <div className="skeleton h-3 w-16 rounded" />
                    </div>
                  ))
                : casts.map((cast, index) => {
                    // Older records stored { fullName, primaryImage }, newer ones { name, profile }
                    const name = cast?.name || cast?.fullName || 'Unknown';
                    const src = cast?.profile || cast?.primaryImage || '/fallbacks/no-cast.jpg';
                    return (
                      <div key={`${name}-${index}`} className="flex w-20 shrink-0 flex-col items-center text-center md:w-24">
                        <img
                          src={src}
                          alt={name}
                          loading="lazy"
                          className="h-20 w-20 rounded-full object-cover ring-1 ring-white/10 md:h-24 md:w-24"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/fallbacks/no-cast.jpg';
                          }}
                        />
                        <p className="mt-2 w-full truncate text-xs font-medium md:text-sm">{name}</p>
                        {cast?.character && <p className="w-full truncate text-[11px] text-gray-400">{cast.character}</p>}
                      </div>
                    );
                  })}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="pt-20">
            <div className="flex items-end justify-between">
              <h2 className="text-lg font-semibold">You may also like</h2>
              <Link to="/movies" className="group flex items-center gap-2 text-sm text-gray-300 hover:text-white">
                View all <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className={`${movieGridClass} mt-6`}>
              {similar.map((m, i) => (
                <MovieCard key={m._id} movie={m} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>

      {showTrailer && (
        <TrailerModal url={movie.trailer} title={movie.originalTitle} onClose={() => setShowTrailer(false)} />
      )}
    </div>
  );
};

export default Moviedetails;
