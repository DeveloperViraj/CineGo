import { Link } from 'react-router-dom';
import { assets } from '../assets/assets';

const Footer = () => {
  return (
    <footer className="mt-10 border-t border-white/10">
      <div className="flex flex-col items-start justify-between gap-10 px-6 py-12 md:flex-row md:px-10 xl:px-20">
        <div className="flex max-w-md flex-col gap-4">
          <img src="/navlogo.webp" alt="CineGo" width="128" height="45" loading="lazy" className="h-auto w-28 sm:w-32" />
          <p className="text-sm text-gray-400">
            Book movie tickets online with ease. New releases are added automatically every day, so there is
            always a show to catch.
          </p>
          <div className="flex flex-wrap gap-3">
            <img src={assets.googlePlay} loading="lazy" className="w-24 sm:w-28" alt="Get it on Google Play" />
            <img src={assets.appStore} loading="lazy" className="w-24 sm:w-28" alt="Download on the App Store" />
          </div>
        </div>

        <div className="flex flex-wrap gap-12 text-sm text-gray-400">
          <div className="flex flex-col gap-2">
            <p className="mb-1 font-semibold text-gray-200">Explore</p>
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/movies" className="hover:text-white">Movies</Link>
            <Link to="/my-bookings" className="hover:text-white">My bookings</Link>
            <Link to="/favourites" className="hover:text-white">Favourites</Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="mb-1 font-semibold text-gray-200">Get in touch</p>
            <a href="tel:+1234567890" className="hover:text-white">+1-234-567-890</a>
            <a href="mailto:contact@example.com" className="hover:text-white">contact@example.com</a>
          </div>
        </div>
      </div>

      <p className="border-t border-white/5 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} CineGo. All Rights Reserved. Movie data from TMDB.
      </p>
    </footer>
  );
};

export default Footer;
