import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon } from 'lucide-react';
import { dayLabel } from '../lib/format';

const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "Book by date" bar that overlaps the bottom of the hero. Each day opens the
// movie list filtered to what's showing that day.
const QuickDates = () => {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
      }),
    []
  );

  return (
    <div className="relative z-30 -mt-14 px-4 md:px-14 lg:px-24">
      <div className="flex flex-col gap-4 rounded-2xl bg-ink-2/85 p-4 shadow-2xl shadow-black/40 ring-1 ring-line backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
        <div className="flex items-center gap-3">
          <span className="bg-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-primary/25">
            <CalendarDaysIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">Book by date</p>
            <p className="text-xs text-gray-400">Shows are scheduled two weeks ahead, every day</p>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          {days.map((d, i) => {
            const label = dayLabel(d);
            return (
              <Link
                key={i}
                to={`/movies?date=${ymdLocal(d)}`}
                className="group flex w-[60px] shrink-0 flex-col items-center rounded-xl bg-ink-3/70 py-2 ring-1 ring-line transition hover:-translate-y-0.5 hover:bg-primary/15 hover:ring-primary/50"
              >
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${i === 0 ? 'text-primary-dull' : 'text-gray-400'}`}>
                  {label === 'Tomorrow' ? 'Tmrw' : label}
                </span>
                <span className="text-xl font-bold leading-tight">{d.getDate()}</span>
                <span className="text-[11px] text-gray-400">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuickDates;
