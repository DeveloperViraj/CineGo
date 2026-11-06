import { Link } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { HeartIcon } from 'lucide-react';
import BlurCircle from '../components/BlurCircle';
import MovieCard, { MovieCardSkeleton, movieGridClass } from '../components/MovieCard';
import { useAppContext } from '../context/Appcontext';

const Favorite = () => {
  const { favorites, favoritesLoading, user, shows } = useAppContext();
  const { openSignIn, loaded } = useClerk();

  if (loaded && !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 pt-24 text-center">
        <HeartIcon className="h-12 w-12 text-primary-dull" />
        <p className="text-xl font-semibold">Sign in to see your favourites</p>
        <button onClick={() => openSignIn()} className="rounded-full bg-primary px-6 py-2 font-medium hover:bg-primary-dull">
          Sign in
        </button>
      </div>
    );
  }

  // Merge in live show info (next show / price) for movies that are still playing
  const live = new Map(shows.map((m) => [m._id, m]));
  const list = favorites.map((m) => live.get(m._id) || m);

  return (
    <div className="relative min-h-[80vh] overflow-hidden px-6 pb-16 pt-28 md:px-8 lg:px-16 xl:px-20">
      <BlurCircle top="80px" right="-40px" />
      <h1 className="text-2xl font-semibold md:text-3xl">Your favourite movies</h1>

      {favoritesLoading && !favorites.length ? (
        <div className={`${movieGridClass} mt-8`}>
          {Array.from({ length: 6 }, (_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      ) : !list.length ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center text-gray-400">
          <HeartIcon className="h-12 w-12" />
          <p>No favourites yet. Tap the ♥ on a movie to save it here.</p>
          <Link to="/movies" className="rounded-full bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dull">
            Browse movies
          </Link>
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

export default Favorite;
