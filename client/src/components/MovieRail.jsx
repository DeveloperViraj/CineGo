import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import SectionHeader from './SectionHeader';
import MovieCard, { MovieCardSkeleton } from './MovieCard';

// Horizontally scrolling row of movie posters (swipe on touch, arrows on desktop).
// `renderItem` lets a rail decorate cards (e.g. the ranked "Top 10" rail).
const MovieRail = ({ eyebrow, title, to, movies = [], loading = false, renderItem, itemClass = 'w-40 sm:w-44 md:w-48 lg:w-52' }) => {
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges, movies.length]);

  const scrollBy = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (!loading && !movies.length) return null;

  const arrow = 'flex h-9 w-9 items-center justify-center rounded-full bg-ink-3 ring-1 ring-line transition hover:bg-white/15 disabled:cursor-default disabled:opacity-30';

  return (
    <section className="relative py-10">
      <div className="px-6 md:px-14 lg:px-24">
        <SectionHeader eyebrow={eyebrow} title={title} to={to}>
          <div className="mr-2 hidden gap-2 md:flex">
            <button className={arrow} onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={`Scroll ${title} left`}>
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button className={arrow} onClick={() => scrollBy(1)} disabled={edges.end} aria-label={`Scroll ${title} right`}>
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </SectionHeader>
      </div>

      <div
        ref={scroller}
        onScroll={updateEdges}
        className="no-scrollbar mt-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-4 pt-2 md:scroll-px-14 md:gap-5 md:px-14 lg:scroll-px-24 lg:px-24"
      >
        {loading && !movies.length
          ? Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={`shrink-0 ${itemClass}`}>
                <MovieCardSkeleton />
              </div>
            ))
          : movies.map((movie, i) => (
              <div key={movie._id} className={`shrink-0 snap-start ${itemClass}`}>
                {renderItem ? renderItem(movie, i) : <MovieCard movie={movie} index={i} />}
              </div>
            ))}
      </div>
    </section>
  );
};

export default MovieRail;
