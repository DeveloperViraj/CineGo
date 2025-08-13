// pages/admin/Addshow.jsx
import { useEffect, useState } from 'react';
import Loading from '../../components/Loading';
import Title from '../../components/Title';
import BlurCircle from '../../components/BlurCircle';
import { DeleteIcon, StarIcon } from 'lucide-react';
import thousandConvert from '../../lib/ThousandCalculate';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/Appcontext';

const DEMO = import.meta.env.VITE_DEMO_MODE === '1';

const Addshow = () => {
  const { axios, getToken, user, bumpMovies } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY;

  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [dateTimeSelection, setDateTimeSelection] = useState({});
  const [dateTimeInput, setDateTimeInput] = useState('');
  const [showprice, setShowPrice] = useState('');
  const [hasFetched, setHasFetched] = useState(false);

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

  const handledatetime = () => {
    if (!selectedMovie) return toast.error('Select a movie');
    if (!showprice) return toast.error('Enter amount');
    if (!dateTimeInput) return toast.error('Select date and time');

    const [date, time] = dateTimeInput.split('T');
    if (!date || !time) return toast.error('Select valid date and time');

    setDateTimeSelection(prev => {
      const times = prev[date] || [];
      if (!times.includes(time)) return { ...prev, [date]: [...times, time] };
      return prev;
    });
  };

  // ✅ Quick schedule: next 3 days at 13:00 & 18:00
  const quickSchedule = () => {
    if (!selectedMovie) return toast.error('Select a movie first');
    if (!showprice) return toast.error('Enter amount first');

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const nextDates = Array.from({ length: 3 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const times = ['13:00', '18:00'];

    setDateTimeSelection(prev => {
      const updated = { ...prev };
      nextDates.forEach(day => {
        const existing = new Set(updated[day] || []);
        times.forEach(t => existing.add(t));
        updated[day] = Array.from(existing);
      });
      return updated;
    });

    toast.success('Added quick schedule (3 days × 2 times)');
  };

  const handleRemoveTime = (date, time) => {
    setDateTimeSelection(prev => {
      const filtered = (prev[date] || []).filter(t => t !== time);
      if (!filtered.length) {
        const { [date]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [date]: filtered };
    });
  };

  const handleadd = async () => {
    try {
      if (!selectedMovie || !showprice) return toast.error('Missing required fields');

      const showsInput = Object.entries(dateTimeSelection).flatMap(([date, times]) =>
        times.map(time => ({ date, time }))
      );

      if (showsInput.length === 0) return toast.error('Add at least one date & time');

      const payload = { movieId: selectedMovie, showsInput, showprice: Number(showprice) };
      const endpoint = DEMO ? '/api/admin/demo-show' : '/api/show/add';

      const token = await getToken();
      const { data } = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        toast.success(DEMO ? 'Demo show(s) added (visible only to you)' : 'Show added successfully');
        setSelectedMovie(null);
        setDateTimeInput('');
        setDateTimeSelection({});
        setShowPrice('');
        bumpMovies(); // 🔁 trigger Movies page refresh
      } else {
        toast.error(data.message || 'Failed to add show');
      }
    } catch (error) {
      toast.error('Error adding show');
    }
  };

  if (!nowPlayingMovies.length) return <Loading />;

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Title text1="Add" text2="Shows" />
      <BlurCircle top="100px" left="250px" />
      <p className="mt-8 font-medium text-lg">Now Playing Movies</p>

      <div className="grid gap-4 mt-3 grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {nowPlayingMovies.slice(0, 22).map((movie, index) => (
          <div
            key={index}
            className={`rounded-lg relative cursor-pointer hover:-translate-y-1.5 transition duration-300 ${selectedMovie === movie.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedMovie(prev => (prev === movie.id ? null : movie.id))}
          >
            <div className="relative">
              <img src={movie.poster} alt="poster" className="w-full object-cover brightness-90 rounded-lg" />
              <div className="text-sm flex items-center justify-between p-2 bg-black/70 w-full rounded-b-lg absolute bottom-0 left-0">
                <div className="flex items-center gap-1 text-gray-400 text-xs">
                  <StarIcon className="w-4 h-4 text-primary fill-primary" />
                  <p>{movie.vote_average}</p>
                </div>
                <p className="text-gray-400 text-xs">{thousandConvert(movie.vote_count)} Votes</p>
              </div>
            </div>
            <p className="text-base font-semibold truncate mt-2">{movie.title}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-sm font-medium">Show Price</label>
            <div className="mt-2 flex items-center gap-2 border border-gray-600 px-3 py-2 rounded-md w-full max-w-md sm:max-w-sm">
              <p className="text-gray-400">{currency}</p>
              <input
                min="0"
                placeholder="Enter show price"
                className="flex-1 font-medium outline-none bg-transparent text-white"
                type="number"
                value={showprice}
                onChange={(e) => setShowPrice(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={quickSchedule}
            className="h-10 mt-8 px-4 bg-primary/80 hover:bg-primary text-white rounded-lg"
          >
            Quick schedule (3 days × 2)
          </button>
        </div>

        <div>
          <label className="text-sm font-medium">Select Date and Time</label>
          <div className="mt-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center border border-gray-600 p-2 rounded-lg max-w-md sm:max-w-sm">
            <input
              className="outline-none rounded-md font-medium text-white bg-transparent w-full"
              type="datetime-local"
              value={dateTimeInput}
              onChange={(e) => setDateTimeInput(e.target.value)}
            />
            <button
              className="bg-primary/80 text-white px-4 py-2 text-sm rounded-lg hover:bg-primary cursor-pointer sm:w-auto"
              onClick={handledatetime}
            >
              Add Time
            </button>
          </div>
        </div>
      </div>

      {Object.keys(dateTimeSelection).length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xl font-semibold">Selected Date-Time</h2>
          <ul className="space-y-3">
            {Object.entries(dateTimeSelection).map(([date, times]) => (
              <li key={date}>
                <div className="font-medium text-white">{date}</div>
                <div className="flex flex-wrap gap-2 mt-1 text-sm">
                  {times.map((time) => (
                    <div key={time} className="border border-primary px-2 py-1 flex items-center rounded text-white bg-primary/10">
                      <span>{time}</span>
                      <DeleteIcon
                        onClick={() => handleRemoveTime(date, time)}
                        width={15}
                        className="ml-2 text-violet-500 hover:text-violet-700 cursor-pointer"
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
        className="flex items-center justify-center px-5 py-2 mt-5 max-sm:text-sm bg-primary hover:bg-primary-dull transition rounded-lg font-medium max-md:px-3 cursor-pointer sm:w-auto"
        onClick={handleadd}
      >
        Add Show
      </button>

      {DEMO && (
        <p className="text-xs text-gray-400 mt-2">
          Demo mode: shows you add here are stored privately and are only visible to you.
        </p>
      )}
    </div>
  );
};

export default Addshow;
