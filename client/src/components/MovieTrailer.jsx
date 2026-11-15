import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayIcon, StarIcon, TicketIcon } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { useAppContext } from '../context/Appcontext';
import { youtubeId } from '../lib/api';

// Trailers for the movies that are actually bookable, laid out as a player + playlist.
// The YouTube player (~1 MB) is only created when the visitor presses play.
const thumb = (id, q = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;

const MovieTrailer = () => {
  const { shows } = useAppContext();
  const trailers = useMemo(
    () =>
      shows
        .map((m) => ({ movie: m, id: youtubeId(m.trailer) }))
        .filter((t) => t.id)
        .slice(0, 8),
    [shows]
  );
  const [currentId, setCurrentId] = useState(null);
  const [playing, setPlaying] = useState(false);

  if (!trailers.length) return null;
  const current = trailers.find((t) => t.movie._id === currentId) || trailers[0];

  return (
    <section className="px-6 py-10 md:px-14 lg:px-24">
      <SectionHeader eyebrow="Watch" title="Latest trailers" />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/40 ring-1 ring-line">
            {playing ? (
              <iframe
                key={current.movie._id}
                src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&rel=0&modestbranding=1`}
                title={`${current.movie.originalTitle} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <button
                onClick={() => setPlaying(true)}
                className="group absolute inset-0 h-full w-full"
                aria-label={`Play ${current.movie.originalTitle} trailer`}
              >
                <img
                  src={thumb(current.id, 'maxresdefault')}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = thumb(current.id);
                  }}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="bg-brand absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-2xl shadow-primary/40 ring-8 ring-white/10 transition group-hover:scale-110 md:h-20 md:w-20">
                  <PlayIcon className="ml-1 h-7 w-7 fill-white md:h-9 md:w-9" />
                </span>
                <span className="absolute bottom-4 left-5 right-5 text-left text-lg font-bold md:bottom-6 md:left-7 md:text-3xl">
                  {current.movie.originalTitle}
                </span>
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-400">{(current.movie.genres || []).slice(0, 3).join(' • ')}</p>
            <Link
              to={`/movies/${current.movie._id}`}
              className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg shadow-white/10 transition "
            >
              <TicketIcon className="h-4 w-4" /> Book {current.movie.originalTitle}
            </Link>
          </div>
        </div>

        {/* Playlist: horizontal on mobile, vertical next to the player on desktop */}
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 lg:max-h-[460px] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0 lg:pr-1">
          {trailers.map((t) => {
            const isCurrent = t.movie._id === current.movie._id;
            return (
              <button
                key={t.movie._id}
                onClick={() => {
                  setCurrentId(t.movie._id);
                  setPlaying(true);
                }}
                aria-label={`Play trailer: ${t.movie.originalTitle}`}
                className={`group flex w-44 shrink-0 flex-col gap-2 rounded-xl p-2 text-left transition lg:w-full lg:flex-row lg:items-center lg:gap-3 ${
                  isCurrent ? 'bg-primary/12 ring-1 ring-primary/40' : 'hover:bg-white/5'
                }`}
              >
                <span className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg lg:w-32">
                  <img src={thumb(t.id, 'mqdefault')} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/10">
                    <PlayIcon className="h-5 w-5 fill-white" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-sm font-semibold ${isCurrent ? 'text-primary-dull' : ''}`}>
                    {t.movie.originalTitle}
                  </span>
                  {t.movie.averageRating > 0 && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <StarIcon className="h-3 w-3 fill-gold text-gold" /> {Number(t.movie.averageRating).toFixed(1)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MovieTrailer;
