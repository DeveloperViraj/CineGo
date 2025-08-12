import BlurCircle from '../components/BlurCircle';
import MovieCard from '../components/MovieCard';
import { useAppContext } from '../context/Appcontext';

const Favorite = () => {
  const { favorites } = useAppContext();

  if (!favorites?.length) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400 text-lg">
        <div>No favourites yet. Tap the ♥ on a movie to add it.</div>
      </div>
    );
  }

  return (
    <div className=' relative px-6 md:px-8 lg:px-16 xl:px-20 overflow-hidden py-10 max-md:py-0'>
      <div className="relative flex items-center justify-between pt-20 pb-5 pl-10 text-lg max-md:pl-0">
        <BlurCircle top='80px' right='-40px' />
        <p className='text-gray-300 font-medium max-md:text-md text-lg'>Your Favourite Movies</p>
        <BlurCircle top='500px' left='0px' />
      </div>
      <div className='flex flex-wrap justify-center gap-8 mt-8'>
        {favorites.map((movie) => (
          <MovieCard key={movie._id} movie={movie} />
        ))}
      </div>
    </div>
  );
};

export default Favorite;
