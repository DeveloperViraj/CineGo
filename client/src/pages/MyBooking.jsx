import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { CalendarIcon, CheckCircle2Icon, ClockIcon, TicketIcon } from 'lucide-react';
import BlurCircle from '../components/BlurCircle';
import { useAppContext } from '../context/Appcontext';
import { tmdbImage } from '../lib/api';
import { CURRENCY, SEAT_HOLD_MINUTES, formatDateTime, formatRuntime } from '../lib/format';

const holdEndsAt = (b) => new Date(b.createdAt).getTime() + SEAT_HOLD_MINUTES * 60 * 1000;

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const BookingCard = ({ booking, now }) => {
  const { show } = booking;
  const movie = show.movie;
  const remaining = holdEndsAt(booking) - now;
  const isPast = new Date(show.showDateTime).getTime() < now;

  return (
    <div className={`flex gap-4 rounded-2xl border p-3 sm:p-4 ${isPast ? 'border-white/5 bg-white/[0.02] opacity-70' : 'border-primary/20 bg-primary/5'}`}>
      <Link to={`/movies/${movie._id}`} className="shrink-0">
        <img
          src={tmdbImage(movie.primaryImage, 'w185')}
          alt={movie.originalTitle}
          className="aspect-[2/3] w-24 rounded-lg object-cover sm:w-28"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/fallback-image.svg';
          }}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        <h2 className="truncate text-lg font-semibold sm:text-xl">{movie.originalTitle}</h2>
        <p className="flex items-center gap-1.5 text-gray-300">
          <CalendarIcon className="h-4 w-4 shrink-0 text-primary-dull" /> {formatDateTime(show.showDateTime)}
        </p>
        {movie.runtime > 0 && (
          <p className="flex items-center gap-1.5 text-gray-400">
            <ClockIcon className="h-4 w-4 shrink-0" /> {formatRuntime(movie.runtime)}
          </p>
        )}
        <p className="text-gray-300">
          Seats: <b className="text-white">{booking.bookedseats.join(', ')}</b>
          <span className="text-gray-500"> ({booking.bookedseats.length})</span>
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <span className="text-xl font-semibold">
            {CURRENCY}
            {booking.amount}
          </span>
          {booking.isPaid ? (
            <span className="flex items-center gap-1.5 rounded-full bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400">
              <CheckCircle2Icon className="h-4 w-4" /> Confirmed
            </span>
          ) : remaining > 0 && booking.paymentLink ? (
            <>
              <a
                href={booking.paymentLink}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium transition hover:bg-primary-dull"
              >
                Pay now
              </a>
              <span className="text-xs text-amber-300">
                Seats held for {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
              </span>
            </>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-400">Payment window expired</span>
          )}
        </div>
      </div>
    </div>
  );
};

const MyBooking = () => {
  const { axios, authHeaders, user } = useAppContext();
  const { openSignIn, loaded: clerkLoaded } = useClerk();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const getBookings = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/user/userbookings', { headers: await authHeaders() });
      if (data.success) setBookings((data.bookings || []).filter((b) => b.show?.movie));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [axios, authHeaders]);

  useEffect(() => {
    if (user) getBookings();
  }, [user, getBookings]);

  // Right after Stripe redirects back, the webhook may take a few seconds:
  // poll while a recent booking is still unpaid.
  const now = useNow(bookings.some((b) => !b.isPaid));
  const awaiting = bookings.some((b) => !b.isPaid && now - new Date(b.createdAt).getTime() < 3 * 60 * 1000);
  useEffect(() => {
    if (!awaiting) return;
    const t = setInterval(getBookings, 4000);
    return () => clearInterval(t);
  }, [awaiting, getBookings]);

  if (clerkLoaded && !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 pt-24 text-center">
        <TicketIcon className="h-12 w-12 text-primary-dull" />
        <p className="text-xl font-semibold">Sign in to see your bookings</p>
        <button onClick={() => openSignIn()} className="rounded-full bg-primary px-6 py-2 font-medium hover:bg-primary-dull">
          Sign in
        </button>
      </div>
    );
  }

  const upcoming = bookings.filter((b) => new Date(b.show.showDateTime).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.show.showDateTime).getTime() < now);

  return (
    <div className="relative min-h-[80vh] px-4 pb-16 pt-28 sm:px-6 md:px-14 lg:px-24">
      <BlurCircle top="0" left="0" />
      <h1 className="text-2xl font-semibold md:text-3xl">Your bookings</h1>

      {loading || !clerkLoaded ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center text-gray-400">
          <TicketIcon className="h-12 w-12 text-primary-dull" />
          <p className="text-lg">No bookings yet.</p>
          <Link to="/movies" className="rounded-full bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dull">
            Find a movie
          </Link>
        </div>
      ) : (
        <>
          {awaiting && (
            <p className="mt-4 flex items-center gap-2 text-sm text-amber-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" /> Waiting for payment confirmation…
            </p>
          )}
          {upcoming.length > 0 && (
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {upcoming.map((b) => (
                <BookingCard key={b._id} booking={b} now={now} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <>
              <h2 className="mt-12 text-lg font-medium text-gray-400">Past</h2>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {past.map((b) => (
                  <BookingCard key={b._id} booking={b} now={now} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MyBooking;
