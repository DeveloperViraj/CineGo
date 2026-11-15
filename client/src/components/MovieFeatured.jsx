import { useMemo } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import MovieRail from './MovieRail';
import MovieCard from './MovieCard';
import { useAppContext } from '../context/Appcontext';

// Home page rows: "Now showing" (everything on sale, by popularity) and a ranked
// "Top rated" row with big outlined numbers.
const MovieFeatured = () => {
  const { shows, moviesLoading, moviesError, bumpMovies } = useAppContext();

  const topRated = useMemo(
    () =>
      [...shows]
        .filter((m) => m.averageRating > 0)
        .sort((a, b) => b.averageRating - a.averageRating || (b.numVotes || 0) - (a.numVotes || 0))
        .slice(0, 10),
    [shows]
  );

  if (!moviesLoading && shows.length === 0) {
    return (
      <section className="px-6 py-16 md:px-14 lg:px-24">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-ink-2 py-14 text-center text-gray-300 ring-1 ring-line">
          <p className="text-lg font-semibold text-white">
            {moviesError ? 'We could not reach the server.' : 'New shows are being scheduled.'}
          </p>
          <p className="text-sm text-gray-400">This usually takes a few seconds.</p>
          <button
            onClick={bumpMovies}
            className="mt-2 flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-medium ring-1 ring-line hover:bg-white/20"
          >
            <RefreshCwIcon className="h-4 w-4" /> Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <MovieRail eyebrow="In cinemas" title="Now showing" to="/movies" movies={shows} loading={moviesLoading} />

      {topRated.length >= 4 && (
        <MovieRail
          eyebrow="Audience favourites"
          title="Top rated this week"
          to="/movies?sort=rating"
          movies={topRated}
          itemClass="w-52 sm:w-56 md:w-60"
          renderItem={(m, i) => (
            <div className="relative pl-14 md:pl-16">
              <span
                aria-hidden="true"
                className="absolute -left-1 bottom-16 select-none text-[6.5rem] font-black leading-none text-transparent [-webkit-text-stroke:2px_rgb(255_255_255/0.3)] md:text-[8rem]"
              >
                {i + 1}
              </span>
              <MovieCard movie={m} index={i} />
            </div>
          )}
        />
      )}
    </>
  );
};

export default MovieFeatured;
