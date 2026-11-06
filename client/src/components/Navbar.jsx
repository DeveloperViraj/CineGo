import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MenuIcon, SearchIcon, TicketPlus, XIcon, ShieldCheck, FlaskConical, HeartIcon } from 'lucide-react';
import { useClerk, UserButton, useUser } from '@clerk/clerk-react';
import { useAppContext } from '../context/Appcontext';

const DEMO = import.meta.env.VITE_DEMO_MODE === '1';

const SUGGESTIONS = ['Tonight', 'This weekend', 'Action', 'Horror', 'Comedy', 'Under ₹250', 'After 6pm'];

const Navbar = () => {
  const { isAdmin } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // search overlay
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setIsOpen(false);
    setShowSearch(false);
  }, [pathname]);

  useEffect(() => {
    if (!showSearch) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e) => e.key === 'Escape' && setShowSearch(false);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [showSearch]);

  const runSearch = (value) => {
    const query = value.trim();
    setShowSearch(false);
    if (!query) return;
    navigate(`/movies?query=${encodeURIComponent(query)}`);
  };

  const linkClass = ({ isActive }) =>
    `transition hover:text-primary-dull ${isActive ? 'text-primary-dull' : ''}`;

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/movies', label: 'Movies' },
    ...(user ? [{ to: '/favourites', label: 'Favourites' }, { to: '/my-bookings', label: 'Bookings' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Dashboard' }] : []),
  ];

  return (
    <header
      className={`fixed left-0 top-0 z-50 flex w-full items-center justify-between px-6 py-4 transition-colors duration-300 md:px-8 lg:px-16 ${
        scrolled || isOpen ? 'bg-[#09090B]/85 shadow-lg shadow-black/20 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <Link to="/" className="max-md:flex-1" aria-label="CineGo home">
        <img src="/navlogo.webp" alt="CineGo" width="128" height="45" className="h-auto w-28 md:w-32" />
      </Link>

      {/* center nav links */}
      <nav
        className={`z-50 flex flex-col items-center gap-6 overflow-hidden transition-[width] duration-300 max-md:absolute max-md:left-0 max-md:top-0 max-md:h-screen max-md:justify-center max-md:bg-black/90 max-md:text-lg max-md:font-medium max-md:backdrop-blur md:flex-row md:rounded-full md:border md:border-gray-300/20 md:bg-white/10 md:px-8 md:py-3 md:backdrop-blur ${
          isOpen ? 'max-md:w-full' : 'max-md:w-0'
        }`}
      >
        <XIcon className="absolute right-6 top-6 h-8 w-8 cursor-pointer md:hidden" onClick={() => setIsOpen(false)} />
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* right actions */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          aria-label="Search"
          onClick={() => setShowSearch(true)}
          className="rounded-full p-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SearchIcon className="h-6 w-6" />
        </button>

        {(isAdmin || DEMO) && (
          <button
            aria-label={isAdmin ? 'Open admin panel' : 'Try admin demo'}
            title={isAdmin ? 'Open admin panel' : 'Try admin demo'}
            onClick={() => {
              if (isAdmin) return navigate('/admin');
              if (!user) return openSignIn({ forceRedirectUrl: '/demo' });
              navigate('/demo');
            }}
            className="rounded-full p-2 hover:bg-white/10 focus:outline-none max-sm:hidden"
          >
            {isAdmin ? <ShieldCheck className="h-6 w-6" /> : <FlaskConical className="h-6 w-6" />}
          </button>
        )}

        {!user ? (
          <button
            onClick={() => openSignIn()}
            className="cursor-pointer rounded-full bg-primary px-4 py-1.5 font-medium transition hover:bg-primary-dull max-md:text-sm sm:px-7 sm:py-2"
          >
            Login
          </button>
        ) : (
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Action
                label="My Bookings"
                labelIcon={<TicketPlus width={15} />}
                onClick={() => navigate('/my-bookings')}
              />
              <UserButton.Action
                label="Favourites"
                labelIcon={<HeartIcon width={15} />}
                onClick={() => navigate('/favourites')}
              />
            </UserButton.MenuItems>
          </UserButton>
        )}

        <MenuIcon className="h-8 w-8 cursor-pointer md:hidden" onClick={() => setIsOpen(true)} />
      </div>

      {/* search overlay */}
      {showSearch && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 pt-24 backdrop-blur-sm"
          onClick={() => setShowSearch(false)}
        >
          <div className="w-[92%] max-w-xl" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(q);
              }}
              className="flex items-center gap-3 rounded-xl border border-white/15 bg-neutral-900/95 px-4"
            >
              <SearchIcon className="h-5 w-5 text-gray-400" />
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Try 'horror this friday', 'action after 6pm', 'under 300'"
                className="w-full bg-transparent py-3.5 text-white outline-none placeholder:text-white/40"
                aria-label="Search movies and shows"
              />
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => runSearch(s)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-gray-200 hover:border-primary hover:bg-primary/20"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
