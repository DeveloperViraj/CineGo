import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MenuIcon, SearchIcon, TicketPlus, XIcon } from "lucide-react";
import { useClerk, UserButton, useUser } from "@clerk/clerk-react";
import { useAppContext } from "../context/Appcontext";

const Navbar = () => {
  const { isAdmin } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  // search overlay
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (showSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [showSearch]);

  const submitSearch = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return setShowSearch(false);
    navigate(`/movies?query=${encodeURIComponent(query)}`);
    setShowSearch(false);
  };

  return (
    <div className="fixed top-0 left-0 z-50 w-full flex items-center justify-between px-6 md:px-8 lg:px-16 py-5">
      <Link to="/" onClick={() => scrollTo(0, 0)} className="max-md:flex-1">
        <img src="/navlogo.png" alt="Logo" className="h-auto w-40" />
      </Link>

      {/* center nav links */}
      <div
        className={`max-md:absolute max-md:top-0 max-md:-left-10 max-md:font-medium max-md:text-lg z-50 flex flex-col md:flex-row items-center max-md:justify-center gap-6 min-md:px-6 py-3 max-md:px-3 max-md:h-screen min-md:rounded-full backdrop-blur bg-black/70 md:bg-white/10 md:border border-gray-300/20 overflow-hidden transition-[width] duration-300 ${
          isOpen ? "max-md:w-full" : "max-md:w-0"
        }`}
      >
        <XIcon
          className="min-md:hidden absolute top-6 right-6 w-8 h-8 cursor-pointer"
          onClick={() => setIsOpen(false)}
        />
        <Link to="/" onClick={() => { scrollTo(0, 0); setIsOpen(false); }} className="hover:text-primary">Home</Link>
        <Link to="/movies" onClick={() => { scrollTo(0, 0); setIsOpen(false); }} className="hover:text-primary">Movies</Link>

        {isAdmin === true && (
          <Link to="/admin" onClick={() => { scrollTo(0, 0); setIsOpen(false); }} className="text-primary">
            Dashboard
          </Link>
        )}

        {isAdmin === false && user && (
          <Link to="/favourites" onClick={() => { scrollTo(0, 0); setIsOpen(false); }} className="hover:text-primary">
            Favourites
          </Link>
        )}

        {user && (
          <Link to="/my-bookings" onClick={() => { scrollTo(0, 0); setIsOpen(false); }} className="hover:text-primary">
            Bookings
          </Link>
        )}
      </div>

      {/* right actions: search icon + auth */}
      <div className="flex items-center gap-4">
        <button
          aria-label="Search"
          onClick={() => setShowSearch(true)}
          className="p-2 rounded-full hover:bg-white/10 focus:outline-none"
        >
          <SearchIcon className="w-6 h-6" />
        </button>

        {!user ? (
          <button
            onClick={openSignIn}
            className="sm:px-7 sm:py-2 bg-primary hover:bg-primary-dull transition px-4 py-1 rounded-full font-medium cursor-pointer max-md:text-sm"
          >
            Login
          </button>
        ) : (
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Action
                label="My Bookings"
                labelIcon={<TicketPlus width={15} />}
                onClick={() => {
                  navigate("/my-bookings");
                }}
              />
            </UserButton.MenuItems>
          </UserButton>
        )}

        <MenuIcon
          className="min-md:hidden w-8 h-8 cursor-pointer"
          onClick={() => setIsOpen(true)}
        />
      </div>

      {/* lightweight search overlay (appears only when clicked) */}
      {showSearch && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] flex items-start justify-center pt-24"
          onClick={() => setShowSearch(false)}
        >
          <form
            onSubmit={submitSearch}
            onClick={(e) => e.stopPropagation()}
            className="w-[92%] max-w-xl"
          >
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search movies e.g. 'horror this Friday', 'under 300', 'action'"
              className="w-full rounded-xl bg-neutral-900/90 border border-white/15 px-4 py-3 outline-none text-white placeholder:text-white/50"
            />
          </form>
        </div>
      )}
    </div>
  );
};

export default Navbar;
