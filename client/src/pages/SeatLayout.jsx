import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClockIcon, Loader2Icon } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { assets } from '../assets/assets';
import Loading from '../components/Loading';
import BlurCircle from '../components/BlurCircle';
import { useAppContext } from '../context/Appcontext';
import { CURRENCY, dayLabel, formatTime, parseDay } from '../lib/format';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SEATS_PER_ROW = 9;
const MAX_SEATS = 5;

const SeatLayout = () => {
  const { axios, authHeaders, user } = useAppContext();
  const { openSignIn } = useClerk();
  const { id, date } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [show, setShow] = useState(null);
  const [error, setError] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`/api/show/getmovie/${id}`)
      .then(({ data }) => {
        if (!cancelled && data.success) setShow({ movie: data.movie, datetime: data.datetime || {} });
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id, axios]);

  const dates = useMemo(() => Object.keys(show?.datetime || {}).sort(), [show]);
  const slots = useMemo(() => show?.datetime?.[date] || [], [show, date]);
  const selectedTime = slots.find((s) => s.showId === params.get('show')) || null;

  // Pre-select the first showtime of the day so seats are visible immediately
  useEffect(() => {
    if (show && slots.length && !selectedTime) {
      setParams({ show: slots[0].showId }, { replace: true });
    }
  }, [show, slots, selectedTime, setParams]);

  const showId = selectedTime?.showId;

  const loadSeats = useCallback(async () => {
    if (!showId) return;
    try {
      const { data } = await axios.get(`/api/booking/seats/${showId}`);
      if (data.success) {
        setOccupiedSeats(data.occupiedSeats || []);
        // Drop anything someone else just booked
        setSelectedSeats((prev) => prev.filter((s) => !(data.occupiedSeats || []).includes(s)));
      }
    } catch {
      /* keep the last known state */
    }
  }, [showId, axios]);

  // Load seats for the chosen show and keep them fresh while the page is open
  useEffect(() => {
    if (!showId) return;
    setSelectedSeats([]);
    setOccupiedSeats([]);
    loadSeats();
    const t = setInterval(() => document.visibilityState === 'visible' && loadSeats(), 15000);
    return () => clearInterval(t);
  }, [showId, loadSeats]);

  const handleSeatClick = (seatId) => {
    if (!selectedTime) return toast('Please select a showtime first');
    if (occupiedSeats.includes(seatId)) return toast.error('That seat is already booked');
    if (!selectedSeats.includes(seatId) && selectedSeats.length >= MAX_SEATS) {
      return toast(`You can select up to ${MAX_SEATS} seats`);
    }
    setSelectedSeats((prev) => (prev.includes(seatId) ? prev.filter((s) => s !== seatId) : [...prev, seatId]));
  };

  const createBooking = async () => {
    if (!user) {
      toast('Please sign in to book');
      return openSignIn({ forceRedirectUrl: window.location.href });
    }
    if (!selectedTime || !selectedSeats.length) return toast.error('Please select a showtime and seats');
    setSubmitting(true);
    try {
      const { data } = await axios.post(
        '/api/booking/create',
        { showId: selectedTime.showId, selectedSeats },
        { headers: await authHeaders() }
      );
      if (data.success && data.url) {
        window.location.href = data.url;
        return; // keep the button in its loading state while Stripe opens
      }
      toast.error(data.message || 'Could not start payment');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not start payment. Please try again.');
      if (err?.response?.status === 409) loadSeats();
    }
    setSubmitting(false);
  };

  if (error) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 pt-24 text-center">
        <p className="text-xl font-semibold">Could not load this show.</p>
        <Link to={`/movies/${id}`} className="rounded-full bg-primary px-5 py-2 text-sm hover:bg-primary-dull">
          Back to movie
        </Link>
      </div>
    );
  }
  if (!show) return <Loading />;

  const price = selectedTime?.price || 0;
  const total = price * selectedSeats.length;

  const seat = (row, n) => {
    const seatId = `${row}${n}`;
    const isSelected = selectedSeats.includes(seatId);
    const isOccupied = occupiedSeats.includes(seatId);
    return (
      <button
        key={seatId}
        onClick={() => handleSeatClick(seatId)}
        disabled={isOccupied}
        title={isOccupied ? `${seatId} (booked)` : seatId}
        aria-label={`Seat ${seatId}${isOccupied ? ', booked' : isSelected ? ', selected' : ''}`}
        aria-pressed={isSelected}
        className={`flex aspect-square w-7 items-center justify-center rounded-t-lg rounded-b text-[10px] font-medium transition sm:w-8 md:w-9 md:text-xs ${
          isOccupied
            ? 'cursor-not-allowed bg-white/10 text-white/25'
            : isSelected
              ? 'bg-primary text-white shadow-md shadow-primary/40'
              : 'border border-primary/60 text-gray-300 hover:bg-primary/25'
        }`}
      >
        {n}
      </button>
    );
  };

  return (
    <div className="relative px-4 pb-36 pt-28 md:px-12 lg:px-20">
      <BlurCircle top="40px" left="-60px" />

      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(`/movies/${id}`)}
          className="mt-1 rounded-full p-2 hover:bg-white/10"
          aria-label="Back to movie"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">{show.movie.originalTitle}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {(show.movie.genres || []).slice(0, 3).join(' • ')}
          </p>
        </div>
      </div>

      {/* Date strip */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {dates.map((d) => {
          const day = parseDay(d);
          const active = d === date;
          return (
            <button
              key={d}
              onClick={() => navigate(`/movies/${id}/${d}`, { replace: true })}
              className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center transition ${
                active ? 'border-primary bg-primary' : 'border-white/15 hover:border-primary/60'
              }`}
            >
              <span className="text-[10px] uppercase opacity-80">{dayLabel(day) === 'Tomorrow' ? 'Tmrw' : dayLabel(day)}</span>
              <span className="text-lg font-semibold leading-tight">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Showtimes */}
      <div className="mt-5 flex flex-wrap gap-2">
        {slots.length === 0 ? (
          <p className="text-gray-400">
            No shows left on this date.{' '}
            {dates[0] && (
              <button className="text-primary-dull underline" onClick={() => navigate(`/movies/${id}/${dates[0]}`, { replace: true })}>
                See the next available date
              </button>
            )}
          </p>
        ) : (
          slots.map((item) => (
            <button
              key={item.showId}
              onClick={() => setParams({ show: item.showId }, { replace: true })}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                selectedTime?.showId === item.showId
                  ? 'border-primary bg-primary text-white'
                  : 'border-white/15 hover:border-primary/60 hover:bg-primary/10'
              }`}
            >
              <ClockIcon className="h-4 w-4" />
              {formatTime(item.time)}
              {item.price ? <span className="text-xs opacity-75">{CURRENCY}{item.price}</span> : null}
            </button>
          ))
        )}
      </div>

      {/* Seat map */}
      {selectedTime && (
        <div className="mt-10 flex flex-col items-center">
          <img src={assets.screenImage} alt="" className="w-full max-w-xl" />
          <p className="mb-8 text-xs font-medium tracking-[0.3em] text-gray-400">SCREEN THIS WAY</p>

          <div className="no-scrollbar w-full overflow-x-auto">
            <div className="mx-auto flex w-max flex-col gap-2">
              {ROWS.map((row, i) => (
                <div key={row} className={`flex items-center gap-1.5 sm:gap-2 ${i === 2 || i === 7 ? 'mt-4' : ''}`}>
                  <span className="w-5 text-center text-xs text-gray-500">{row}</span>
                  {Array.from({ length: 4 }, (_, k) => seat(row, k + 1))}
                  <span className="w-4 sm:w-6" />
                  {Array.from({ length: SEATS_PER_ROW - 4 }, (_, k) => seat(row, k + 5))}
                  <span className="w-5 text-center text-xs text-gray-500">{row}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-primary/60" /> Available</span>
            <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-primary" /> Selected</span>
            <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-white/10" /> Booked</span>
          </div>
        </div>
      )}

      {/* Checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#09090B]/95 px-4 py-4 backdrop-blur md:px-12 lg:px-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0 text-sm">
            {selectedSeats.length ? (
              <>
                <p className="truncate text-gray-300">
                  {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''}: <b className="text-white">{selectedSeats.join(', ')}</b>
                </p>
                <p className="text-lg font-semibold">
                  {CURRENCY}{total}
                  <span className="ml-2 text-xs font-normal text-gray-400">({CURRENCY}{price} × {selectedSeats.length})</span>
                </p>
              </>
            ) : (
              <p className="text-gray-400">
                {selectedTime ? `Select up to ${MAX_SEATS} seats` : 'Choose a showtime'}
              </p>
            )}
          </div>
          <button
            onClick={createBooking}
            disabled={!selectedSeats.length || submitting}
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium transition hover:bg-primary-dull disabled:cursor-not-allowed disabled:opacity-40 max-md:px-5 max-md:text-sm"
          >
            {submitting ? <Loader2Icon className="h-5 w-5 animate-spin" /> : null}
            {submitting ? 'Opening payment…' : 'Proceed to pay'}
            {!submitting && <ArrowRight className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeatLayout;
