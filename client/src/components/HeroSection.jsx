import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarIcon, ClockIcon, PlayIcon, StarIcon, TicketIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/Appcontext';
import { tmdbImage } from '../lib/api';
import { formatRuntime, releaseYear } from '../lib/format';
import TrailerModal from './TrailerModal';

const ROTATE_MS = 7000;

// Home hero: rotates through the top movies that are actually on sale right now
// (updated automatically every day). The optimised static background shows
// instantly and stays as the fallback while movies load.
const HeroSection = () => {
  const { shows } = useAppContext();
  const featured = useMemo(() => shows.filter((m) => m.backdrop).slice(0, 5), [shows]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [trailer, setTrailer] = useState(null);
  // Only download backdrops as the carousel reaches them (current + next)
  const [reach, setReach] = useState(1);

  useEffect(() => {
    if (featured.length < 2 || paused || trailer) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % featured.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [featured.length, paused, trailer]);

  useEffect(() => {
    setReach((r) => Math.max(r, index + 1));
  }, [index]);

  const movie = featured.length ? featured[index % featured.length] : null;

  return (
    <section
      className="relative flex h-[92vh] min-h-[560px] w-full items-end overflow-hidden md:items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Static, preloaded background (≈100 KB WebP instead of a 2 MB JPG) */}
      <picture>
        <source media="(max-width: 767px)" srcSet="/hero-bg-mobile.webp" />
        <img
          src="/hero-bg.webp"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>

      {featured.map((m, i) =>
        i > reach ? null : (
        <img
          key={m._id}
          src={tmdbImage(m.backdrop, 'w1280')}
          alt=""
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            i === index % featured.length ? 'opacity-100' : 'opacity-0'
          }`}
        />
        )
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-[#09090B]/40" />

      <div className="relative z-10 w-full px-6 pb-16 md:px-14 md:pb-0 lg:px-24">
        {movie ? (
          <div key={movie._id} className="max-w-xl animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-dull">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-dull" /> Now showing
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">{movie.originalTitle}</h1>
            {movie.tagline && <p className="mt-2 text-lg italic text-gray-300">{movie.tagline}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-300">
              {movie.genres?.length > 0 && <span>{movie.genres.slice(0, 3).join(' | ')}</span>}
              {releaseYear(movie.releaseDate) && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" /> {releaseYear(movie.releaseDate)}
                </span>
              )}
              {movie.runtime > 0 && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" /> {formatRuntime(movie.runtime)}
                </span>
              )}
              {movie.averageRating > 0 && (
                <span className="flex items-center gap-1">
                  <StarIcon className="h-4 w-4 fill-primary text-primary" /> {Number(movie.averageRating).toFixed(1)}
                </span>
              )}
            </div>

            <p className="mt-4 line-clamp-3 max-w-lg text-gray-300">{movie.description}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={`/movies/${movie._id}`}
                className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium transition hover:bg-primary-dull"
              >
                <TicketIcon className="h-5 w-5" /> Book tickets
              </Link>
              {movie.trailer && (
                <button
                  onClick={() => setTrailer(movie)}
                  className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 font-medium backdrop-blur transition hover:bg-white/20"
                >
                  <PlayIcon className="h-5 w-5" /> Trailer
                </button>
              )}
            </div>

            {featured.length > 1 && (
              <div className="mt-8 flex gap-2" role="tablist" aria-label="Featured movies">
                {featured.map((m, i) => (
                  <button
                    key={m._id}
                    onClick={() => setIndex(i)}
                    aria-label={`Show ${m.originalTitle}`}
                    aria-selected={i === index % featured.length}
                    role="tab"
                    className={`h-1.5 rounded-full transition-all ${
                      i === index % featured.length ? 'w-8 bg-primary' : 'w-3 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-xl animate-fade-in">
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">
              From screen to seat <span className="text-primary-dull">in seconds</span>
            </h1>
            <p className="mt-4 max-w-md text-gray-300">
              Book tickets for the latest movies in cinemas. Pick a show, choose your seats and pay securely.
            </p>
            <Link
              to="/movies"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium transition hover:bg-primary-dull"
            >
              Explore movies <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        )}
      </div>

      {trailer && <TrailerModal url={trailer.trailer} title={trailer.originalTitle} onClose={() => setTrailer(null)} />}
    </section>
  );
};

export default HeroSection;
