import { Link } from 'react-router-dom';
import { assets } from '../assets/assets';

const Footer = () => {
  return (
    <footer className="mt-12 border-t border-line bg-ink-2/60">
      <div className="grid gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-14 lg:px-24">
        <div className="flex max-w-sm flex-col gap-4">
          <img src="/navlogo.webp" alt="CineGo" width="128" height="45" loading="lazy" className="h-auto w-28 sm:w-32" />
          <p className="text-sm leading-relaxed text-gray-400">
            Book movie tickets in seconds. What&apos;s playing in cinemas is updated automatically every day, so
            there&apos;s always a show to catch.
          </p>
          <div className="flex flex-wrap gap-3">
            <img src={assets.googlePlay} loading="lazy" className="w-24 opacity-90 sm:w-28" alt="Get it on Google Play" />
            <img src={assets.appStore} loading="lazy" className="w-24 opacity-90 sm:w-28" alt="Download on the App Store" />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 text-sm text-gray-400">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-200">Explore</p>
          <Link to="/" className="transition hover:text-white">Home</Link>
          <Link to="/movies" className="transition hover:text-white">Movies</Link>
          <Link to="/my-bookings" className="transition hover:text-white">My bookings</Link>
          <Link to="/favourites" className="transition hover:text-white">Favourites</Link>
        </div>

        <div className="flex flex-col gap-2.5 text-sm text-gray-400">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-200">Get in touch</p>
          <a href="tel:+1234567890" className="transition hover:text-white">+1-234-567-890</a>
          <a href="mailto:contact@example.com" className="transition hover:text-white">contact@example.com</a>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 border-t border-line px-6 py-5 text-xs text-gray-500 sm:flex-row md:px-14 lg:px-24">
        <p>© {new Date().getFullYear()} CineGo. All rights reserved.</p>
        <p>Movie data and images from TMDB.</p>
      </div>
    </footer>
  );
};

export default Footer;
