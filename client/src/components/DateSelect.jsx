import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClockIcon } from 'lucide-react';
import BlurCircle from './BlurCircle';
import { CURRENCY, dayLabel, formatTime, parseDay } from '../lib/format';

// Pick a date, then a showtime — clicking a showtime goes straight to seat selection.
const DateSelect = ({ datetime = {}, id, loading = false }) => {
  const navigate = useNavigate();
  const dates = useMemo(() => Object.keys(datetime).sort(), [datetime]);
  const [picked, setPicked] = useState(null);
  const selected = picked && datetime[picked] ? picked : dates[0];

  const goToSeats = (date, showId) =>
    navigate(`/movies/${id}/${date}${showId ? `?show=${showId}` : ''}`);

  return (
    <section id="dates" className="scroll-mt-28 pt-16">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 p-6 sm:p-8">
        <BlurCircle top="-80px" left="60px" />
        <h2 className="text-lg font-semibold">Choose date &amp; time</h2>

        {loading ? (
          <div className="mt-6 flex gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-20 w-16 rounded-xl" />
            ))}
          </div>
        ) : dates.length === 0 ? (
          <p className="mt-4 text-gray-300">
            No upcoming shows for this movie right now. New showtimes are added automatically every day.
          </p>
        ) : (
          <>
            <div className="no-scrollbar mt-6 flex gap-3 overflow-x-auto pb-1">
              {dates.map((date) => {
                const d = parseDay(date);
                const active = selected === date;
                return (
                  <button
                    key={date}
                    onClick={() => setPicked(date)}
                    className={`flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-xl border text-center transition ${
                      active
                        ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30'
                        : 'border-primary/40 text-gray-200 hover:bg-primary/20'
                    }`}
                  >
                    <span className="text-[11px] uppercase tracking-wide opacity-80">
                      {dayLabel(d) === 'Tomorrow' ? 'Tmrw' : dayLabel(d)}
                    </span>
                    <span className="text-xl font-semibold leading-tight">{d.getDate()}</span>
                    <span className="text-xs opacity-80">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {(datetime[selected] || []).map((slot) => (
                <button
                  key={slot.showId}
                  onClick={() => goToSeats(selected, slot.showId)}
                  className="group flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-sm transition hover:border-primary hover:bg-primary/20"
                >
                  <ClockIcon className="h-4 w-4 text-primary-dull" />
                  <span className="font-medium">{formatTime(slot.time)}</span>
                  {slot.price ? (
                    <span className="text-xs text-gray-400 group-hover:text-gray-200">
                      {CURRENCY}
                      {slot.price}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default DateSelect;
