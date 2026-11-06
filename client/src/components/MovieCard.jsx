import { StarIcon, TicketIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tmdbImage } from '../lib/api';
import { CURRENCY, formatRuntime, formatNextShow, releaseYear } from '../lib/format';

// Poster card used in every movie grid. Posters are 2:3, so we show them uncropped
// and load a right-sized TMDB image (w185–w500) instead of the full w500/w780 file.
const MovieCard = ({ movie, index = 0 }) => {
  const poster = movie.primaryImage;
  const meta = [releaseYear(movie.releaseDate), (movie.genres || []).slice(0, 2).join(' / '), formatRuntime(movie.runtime)]
    .filter(Boolean)
    .join(' • ');

  return (
    <Link
      to={`/movies/${movie._id}`}
      className="group block w-full animate-fade-in focus:outline-none"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 transition duration-300 group-hover:ring-primary/70 group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <img
          src={tmdbImage(poster, 'w342')}
          srcSet={`${tmdbImage(poster, 'w185')} 185w, ${tmdbImage(poster, 'w342')} 342w, ${tmdbImage(poster, 'w500')} 500w`}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          alt={`${movie.originalTitle} poster`}
          loading={index < 6 ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.srcset = '';
            e.currentTarget.src = '/fallback-image.svg';
          }}
        />

        {movie.averageRating > 0 && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium backdrop-blur">
            <StarIcon className="h-3 w-3 fill-primary text-primary" />
            {Number(movie.averageRating).toFixed(1)}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex translate-y-2 items-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:hidden">
          <span className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2 text-sm font-medium">
            <TicketIcon className="h-4 w-4" /> Book tickets
          </span>
        </div>
      </div>

      <p className="mt-3 truncate font-semibold leading-tight" title={movie.originalTitle}>
        {movie.originalTitle}
      </p>
      <p className="mt-1 truncate text-xs text-gray-400">{meta}</p>
      {(movie.minPrice || movie.nextShow) && (
        <p className="mt-1.5 truncate text-xs text-gray-300">
          {movie.minPrice ? (
            <span className="font-medium text-primary-dull">
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
    <div className="skeleton aspect-[2/3] rounded-xl" />
    <div className="skeleton mt-3 h-4 w-3/4 rounded" />
    <div className="skeleton mt-2 h-3 w-1/2 rounded" />
  </div>
);

export const movieGridClass =
  'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export default MovieCard;
