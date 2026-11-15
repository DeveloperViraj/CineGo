import HeroSection from '../components/HeroSection';
import QuickDates from '../components/QuickDates';
import MovieFeatured from '../components/MovieFeatured';
import GenreTiles from '../components/GenreTiles';
import MovieTrailer from '../components/MovieTrailer';
import Perks from '../components/Perks';

const Home = () => {
  return (
    <div>
      <HeroSection />
      <QuickDates />
      <MovieFeatured />
      <GenreTiles />
      <MovieTrailer />
      <Perks />
    </div>
  );
};

export default Home;
