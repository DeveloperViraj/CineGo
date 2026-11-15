import { StarIcon, TicketIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tmdbImage } from '../lib/api';
import { CURRENCY, formatRuntime, formatNextShow, releaseYear } from '../lib/format';

// Poster card used in every movie grid and rail. Posters are 2:3, so we show them
// uncropped and load a right-sized TMDB image (w185–w500).
const MovieCard = ({ movie, index = 0, eager = false }) => {
  const poster = movie.primaryImage;
  const meta = [releaseYear(movie.releaseDate), (movie.genres || []).slice(0, 2).join(' / '), formatRuntime(movie.runtime)]
    .filter(Boolean)
    .join(' • ');

  return (
    <Link
      to={`/movies/${movie._id}`}
      className="group block w-full animate-fade-in rounded-2xl focus:outline-none"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-ink-3 shadow-lg shadow-black/30 ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-primary/15 group-hover:ring-primary/60 group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <img
          src={tmdbImage(poster, 'w342')}
          srcSet={`${tmdbImage(poster, 'w185')} 185w, ${tmdbImage(poster, 'w342')} 342w, ${tmdbImage(poster, 'w500')} 500w`}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          alt={`${movie.originalTitle} poster`}
          loading={eager || index < 6 ? 'eager' : 'lazy'}
          decoding="async"
          draggable="false"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.srcset = '';
            e.currentTarget.src = '/fallback-image.svg';
          }}
        />

        {movie.averageRating > 0 && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-gold ring-1 ring-white/10 backdrop-blur-md">
            <StarIcon className="h-3 w-3 fill-gold" />
            {Number(movie.averageRating).toFixed(1)}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex translate-y-3 items-end bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3 pt-12 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:hidden">
          <span className="bg-brand flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold shadow-lg shadow-primary/30">
            <TicketIcon className="h-4 w-4" /> Book tickets
          </span>
        </div>
      </div>

      <p className="mt-3 truncate font-semibold leading-tight transition group-hover:text-primary-dull" title={movie.originalTitle}>
        {movie.originalTitle}
      </p>
      <p className="mt-1 truncate text-xs text-gray-400">{meta}</p>
      {(movie.minPrice || movie.nextShow) && (
        <p className="mt-1.5 truncate text-xs text-gray-300">
          {movie.minPrice ? (
            <span className="font-semibold text-primary-dull">
              from {CURRENCY}
              {movie.minPrice}
            </span>
          ) : null}
          {movie.minPrice && movie.nextShow ? ' · ' : ''}
          {movie.nextShow ? formatNextShow(movie.nextShow) : ''}
        </p>
      )}
    </Link>
  );
};

export const MovieCardSkeleton = () => (
  <div className="w-full">
    <div className="skeleton aspect-[2/3] rounded-2xl" />
    <div className="skeleton mt-3 h-4 w-3/4 rounded" />
    <div className="skeleton mt-2 h-3 w-1/2 rounded" />
  </div>
);

export const movieGridClass =
  'grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export default MovieCard;
