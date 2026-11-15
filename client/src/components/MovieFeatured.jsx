import { ArrowRight, RefreshCwIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import BlurCircle from './BlurCircle';
import MovieCard, { MovieCardSkeleton, movieGridClass } from './MovieCard';
import { useAppContext } from '../context/Appcontext';

const MovieFeatured = () => {
  const { shows, moviesLoading, moviesError, bumpMovies } = useAppContext();
  const list = shows.slice(0, 12);

  return (
    <section className="relative px-6 py-14 md:px-8 lg:px-16 xl:px-20">
      <BlurCircle top="0" right="-80px" />
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-primary-dull">In cinemas</p>
          <h2 className="mt-1 text-2xl font-semibold md:text-3xl">Now showing</h2>
        </div>
        <Link to="/movies" className="group flex items-center gap-2 text-sm text-gray-300 hover:text-white">
          View all
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className={`${movieGridClass} mt-8`}>
        {list.length > 0
          ? list.map((movie, i) => <MovieCard key={movie._id} movie={movie} index={i} />)
          : moviesLoading && Array.from({ length: 6 }, (_, i) => <MovieCardSkeleton key={i} />)}
      </div>

      {!moviesLoading && list.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-white/10 py-12 text-center text-gray-400">
          <p>{moviesError ? 'We could not reach the server.' : 'New shows are being scheduled — check back in a moment.'}</p>
          <button
            onClick={bumpMovies}
            className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            <RefreshCwIcon className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      {shows.length > list.length && (
        <div className="mt-12 flex justify-center">
          <Link
            to="/movies"
            className="rounded-full bg-primary px-10 py-3 font-medium transition hover:bg-primary-dull max-md:px-6 max-md:text-sm"
          >
            See all {shows.length} movies
          </Link>
        </div>
      )}
    </section>
  );
};

export default MovieFeatured;
