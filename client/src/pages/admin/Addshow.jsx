import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2Icon, DeleteIcon, Loader2Icon, StarIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import Loading from '../../components/Loading';
import Title from '../../components/Title';
import BlurCircle from '../../components/BlurCircle';
import AutoSchedulePanel from '../../components/AutoSchedulePanel';
import { useAppContext } from '../../context/Appcontext';
import { CURRENCY, compactNumber } from '../../lib/format';

// Local "YYYY-MM-DD" (toISOString() would give the UTC date and shift late-night slots)
const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const Addshow = () => {
  const { axios, authHeaders, bumpMovies, isDemo } = useAppContext();

  const [nowPlayingMovies, setNowPlayingMovies] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  // { "YYYY-MM-DD": ["13:00", "18:00"] } in the admin's local time
  const [dateTimeSelection, setDateTimeSelection] = useState({});
  const [dateTimeInput, setDateTimeInput] = useState('');
  const [showprice, setShowPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchnowplaying = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/show/nowplaying', { headers: await authHeaders() });
      if (data.success) setNowPlayingMovies(data.movies || []);
      else throw new Error(data.message);
    } catch (error) {
      setNowPlayingMovies([]);
      toast.error(error?.response?.data?.message || 'Now playing fetch failed');
    }
  }, [axios, authHeaders]);

  useEffect(() => {
    fetchnowplaying();
  }, [fetchnowplaying]);

  const handledatetime = () => {
    if (!dateTimeInput) return toast.error('Select date and time');
    const [date, time] = dateTimeInput.split('T');
    if (!date || !time) return toast.error('Select a valid date and time');
    if (new Date(dateTimeInput) <= new Date()) return toast.error('Pick a time in the future');
    setDateTimeSelection((prev) => {
      const times = prev[date] || [];
      return times.includes(time) ? prev : { ...prev, [date]: [...times, time].sort() };
    });
  };

  // Quick schedule: next 14 days × 2 shows (skips slots that already passed today)
  const quickSchedule = () => {
    const now = new Date();
    const times = ['13:00', '18:00'];
    setDateTimeSelection((prev) => {
      const updated = { ...prev };
      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(now.getDate() + i);
        const day = ymdLocal(d);
        const set = new Set(updated[day] || []);
        times.forEach((t) => {
          if (new Date(`${day}T${t}`) > now) set.add(t);
        });
        if (set.size) updated[day] = [...set].sort();
      }
      return updated;
    });
    toast.success('Quick schedule added (14 days × 2 shows)');
  };

  const handleRemoveTime = (date, time) => {
    setDateTimeSelection((prev) => {
      const remaining = (prev[date] || []).filter((t) => t !== time);
      if (!remaining.length) {
        const { [date]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [date]: remaining };
    });
  };

  const handleadd = async () => {
    if (!selectedMovie) return toast.error('Select a movie');
    if (!(Number(showprice) > 0)) return toast.error('Enter a ticket price');
    // Send absolute timestamps computed in the admin's browser timezone
    const showsInput = Object.entries(dateTimeSelection).flatMap(([date, times]) =>
      times.map((time) => ({ date, time, dateTime: new Date(`${date}T${time}`).toISOString() }))
    );
    if (!showsInput.length) return toast.error('Add at least one date & time');

    setSaving(true);
    try {
      const { data } = await axios.post(
        '/api/show/add',
        { movieId: selectedMovie, showsInput, showprice: Number(showprice) },
        { headers: await authHeaders() }
      );
      if (!data.success) throw new Error(data.message);
      toast.success(data.message || 'Shows added');
      setSelectedMovie(null);
      setDateTimeInput('');
      setDateTimeSelection({});
      setShowPrice('');
      bumpMovies();
      fetchnowplaying();
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Error adding show');
    } finally {
      setSaving(false);
    }
  };

  if (nowPlayingMovies === null) return <Loading />;
  const count = Object.values(dateTimeSelection).reduce((n, t) => n + t.length, 0);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Title text1="Add" text2="Shows" />
      <BlurCircle top="100px" left="250px" />

      <AutoSchedulePanel onSynced={() => { bumpMovies(); fetchnowplaying(); }} />
      <p className="mt-4 text-sm text-gray-400">
        Use this page for special screenings or custom prices. Regular shows are created automatically.
        {isDemo && ' In demo mode, shows you add are private to your account.'}
      </p>

      <p className="mt-8 text-lg font-medium">Now playing in cinemas</p>
      {nowPlayingMovies.length === 0 ? (
        <p className="mt-3 text-gray-400">Could not load the TMDB list. Check the TMDB_KEY on the server.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {nowPlayingMovies.map((movie) => (
            <button
              type="button"
              key={movie.id}
              className={`rounded-lg text-left transition hover:-translate-y-1 ${selectedMovie === movie.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedMovie((prev) => (prev === movie.id ? null : movie.id))}
            >
              <div className="relative">
                <img src={movie.poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover brightness-90" />
                {movie.scheduled && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-green-600/90 px-2 py-0.5 text-[11px] font-medium">
                    <CheckCircle2Icon className="h-3 w-3" /> On sale
                  </span>
                )}
                <div className="absolute bottom-0 left-0 flex w-full justify-between rounded-b-lg bg-black/70 p-2 text-xs">
                  <span className="flex items-center gap-1 text-gray-300">
                    <StarIcon className="h-3.5 w-3.5 fill-primary text-primary" />
                    {movie.vote_average}
                  </span>
                  <span className="text-gray-400">{compactNumber(movie.vote_count)} votes</span>
                </div>
              </div>
              <p className="mt-2 truncate font-semibold">{movie.title}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm font-medium" htmlFor="price">Ticket price</label>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-600 px-3 py-2">
            <span className="text-gray-400">{CURRENCY}</span>
            <input
              id="price"
              type="number"
              min="1"
              className="w-32 bg-transparent text-white outline-none"
              placeholder="e.g. 250"
              value={showprice}
              onChange={(e) => setShowPrice(e.target.value)}
            />
          </div>
        </div>
        <button type="button" onClick={quickSchedule} className="h-10 rounded-lg bg-primary/80 px-4 text-white hover:bg-primary">
          Quick schedule (14 days × 2)
        </button>
      </div>

      <div className="mt-6">
        <label className="text-sm font-medium" htmlFor="dt">Add a date and time</label>
        <div className="mt-2 flex max-w-md gap-3 rounded-lg border border-gray-600 p-2">
          <input
            id="dt"
            type="datetime-local"
            className="flex-1 bg-transparent text-white outline-none"
            value={dateTimeInput}
            onChange={(e) => setDateTimeInput(e.target.value)}
          />
          <button onClick={handledatetime} className="rounded-lg bg-primary/80 px-4 text-white hover:bg-primary">
            Add
          </button>
        </div>
      </div>

      {count > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Selected ({count} shows)</h2>
          <ul className="space-y-3">
            {Object.entries(dateTimeSelection)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, times]) => (
                <li key={date}>
                  <p className="font-medium">
                    {new Date(`${date}T00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {times.map((time) => (
                      <div key={time} className="flex items-center gap-2 rounded border border-primary bg-primary/10 px-2 py-1">
                        <span>{time}</span>
                        <DeleteIcon
                          size={15}
                          className="cursor-pointer text-violet-400 hover:text-violet-200"
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
        disabled={saving}
        className="mb-10 mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium hover:bg-primary-dull disabled:opacity-50"
      >
        {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
        Add shows
      </button>
    </div>
  );
};

export default Addshow;
