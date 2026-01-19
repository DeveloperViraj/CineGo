// pages/admin/Addshow.jsx
import { useEffect, useState } from 'react';
import Loading from '../../components/Loading';
import Title from '../../components/Title';
import BlurCircle from '../../components/BlurCircle';
import { DeleteIcon, StarIcon } from 'lucide-react';
import thousandConvert from '../../lib/ThousandCalculate';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/Appcontext';

// Demo mode flag (used to isolate demo data from real data)
const DEMO = import.meta.env.VITE_DEMO_MODE === '1';

const Addshow = () => {
  const { axios, getToken, user, bumpMovies } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY;

  // State for now-playing movies fetched from TMDB via backend
  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);

  // Currently selected movie ID
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Object structure: { "YYYY-MM-DD": ["13:00", "18:00"] }
  const [dateTimeSelection, setDateTimeSelection] = useState({});

  // Controlled input for datetime-local picker
  const [dateTimeInput, setDateTimeInput] = useState('');

  // Ticket price for the show
  const [showprice, setShowPrice] = useState('');

  // Prevent duplicate fetch on re-render
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch now-playing movies once user is available
  const fetchnowplaying = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/show/nowplaying', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) setNowPlayingMovies(data.movies);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Now Playing fetch failed');
    }
  };

  useEffect(() => {
    if (user && !hasFetched) {
      fetchnowplaying();
      setHasFetched(true);
    }
  }, [user, hasFetched]);

  // Add a manually selected date & time
  const handledatetime = () => {
    if (!selectedMovie) return toast.error('Select a movie');
    if (!showprice) return toast.error('Enter amount');
    if (!dateTimeInput) return toast.error('Select date and time');

    const [date, time] = dateTimeInput.split('T');
    if (!date || !time) return toast.error('Select valid date and time');

    setDateTimeSelection(prev => {
      const times = prev[date] || [];
      if (!times.includes(time)) {
        return { ...prev, [date]: [...times, time] };
      }
      return prev;
    });
  };

  // Quick schedule: auto-generate shows for the next 14 days
  // Two fixed time slots per day to avoid overbooking
  const quickSchedule = () => {
    if (!selectedMovie) return toast.error('Select a movie first');
    if (!showprice) return toast.error('Enter amount first');

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const nextDates = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const times = ['13:00', '18:00'];

    setDateTimeSelection(prev => {
      const updated = { ...prev };

      nextDates.forEach(day => {
        const existingTimes = new Set(updated[day] || []);
        times.forEach(t => existingTimes.add(t));
        updated[day] = Array.from(existingTimes);
      });

      return updated;
    });

    toast.success('Quick schedule added (14 days × 2 shows)');
  };

  // Remove a specific time slot from a selected date
  const handleRemoveTime = (date, time) => {
    setDateTimeSelection(prev => {
      const remaining = (prev[date] || []).filter(t => t !== time);

      if (!remaining.length) {
        const { [date]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [date]: remaining };
    });
  };

  // Submit shows to backend
  const handleadd = async () => {
    try {
      if (!selectedMovie || !showprice) {
        return toast.error('Missing required fields');
      }

      const showsInput = Object.entries(dateTimeSelection).flatMap(
        ([date, times]) => times.map(time => ({ date, time }))
      );

      if (showsInput.length === 0) {
        return toast.error('Add at least one date & time');
      }

      const payload = {
        movieId: selectedMovie,
        showsInput,
        showprice: Number(showprice)
      };

      const endpoint = DEMO ? '/api/admin/demo-show' : '/api/show/add';
      const token = await getToken();

      const { data } = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        toast.success(
          DEMO
            ? 'Demo show(s) added (visible only to you)'
            : 'Shows added successfully'
        );

        setSelectedMovie(null);
        setDateTimeInput('');
        setDateTimeSelection({});
        setShowPrice('');

        // Trigger refresh on Movies page
        bumpMovies();
      } else {
        toast.error(data.message || 'Failed to add show');
      }
    } catch {
      toast.error('Error adding show');
    }
  };

  if (!nowPlayingMovies.length) return <Loading />;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Title text1="Add" text2="Shows" />
      <BlurCircle top="100px" left="250px" />

      <p className="mt-8 font-medium text-lg">Now Playing Movies</p>

      <div className="grid gap-4 mt-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {nowPlayingMovies.slice(0, 22).map((movie) => (
          <div
            key={movie.id}
            className={`rounded-lg cursor-pointer transition hover:-translate-y-1.5 ${
              selectedMovie === movie.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() =>
              setSelectedMovie(prev => (prev === movie.id ? null : movie.id))
            }
          >
            <div className="relative">
              <img
                src={movie.poster}
                alt="poster"
                className="w-full rounded-lg object-cover brightness-90"
              />

              <div className="absolute bottom-0 left-0 w-full bg-black/70 p-2 flex justify-between text-xs rounded-b-lg">
                <div className="flex items-center gap-1 text-gray-400">
                  <StarIcon className="w-4 h-4 fill-primary text-primary" />
                  <span>{movie.vote_average}</span>
                </div>
                <span className="text-gray-400">
                  {thousandConvert(movie.vote_count)} Votes
                </span>
              </div>
            </div>

            <p className="mt-2 font-semibold truncate">{movie.title}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-sm font-medium">Show Price</label>
            <div className="mt-2 flex items-center gap-2 border border-gray-600 px-3 py-2 rounded-md">
              <span className="text-gray-400">{currency}</span>
              <input
                type="number"
                min="0"
                className="bg-transparent outline-none flex-1 text-white"
                placeholder="Enter show price"
                value={showprice}
                onChange={(e) => setShowPrice(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={quickSchedule}
            className="h-10 px-4 bg-primary/80 hover:bg-primary text-white rounded-lg"
          >
            Quick schedule (14 days × 2)
          </button>
        </div>

        <div>
          <label className="text-sm font-medium">Select Date and Time</label>
          <div className="mt-2 flex gap-3 border border-gray-600 p-2 rounded-lg">
            <input
              type="datetime-local"
              className="bg-transparent outline-none text-white flex-1"
              value={dateTimeInput}
              onChange={(e) => setDateTimeInput(e.target.value)}
            />
            <button
              onClick={handledatetime}
              className="bg-primary/80 hover:bg-primary text-white px-4 rounded-lg"
            >
              Add Time
            </button>
          </div>
        </div>
      </div>

      {Object.keys(dateTimeSelection).length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Selected Date-Time</h2>

          <ul className="space-y-3">
            {Object.entries(dateTimeSelection).map(([date, times]) => (
              <li key={date}>
                <p className="font-medium">{date}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {times.map(time => (
                    <div
                      key={time}
                      className="flex items-center gap-2 border border-primary bg-primary/10 px-2 py-1 rounded"
                    >
                      <span>{time}</span>
                      <DeleteIcon
                        size={15}
                        className="cursor-pointer text-violet-500 hover:text-violet-700"
                        onClick={() => handleRemoveTime(date, time)}
                      />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleadd}
        className="mt-5 px-5 py-2 bg-primary hover:bg-primary-dull rounded-lg font-medium"
      >
        Add Show
      </button>

      {DEMO && (
        <p className="text-xs text-gray-400 mt-2">
          Demo mode: shows added here are private and visible only to you.
        </p>
      )}
    </div>
  );
};

export default Addshow;
