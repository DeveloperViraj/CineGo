import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayIcon, TicketIcon } from 'lucide-react';
import BlurCircle from './BlurCircle';
import { useAppContext } from '../context/Appcontext';
import { youtubeId } from '../lib/api';

// Trailers for the movies that are actually bookable.
// Previously this section called TMDB from the browser (9 extra requests and a
// TMDB key shipped in the JS bundle) and embedded a YouTube iframe on page load.
// Now it reuses trailer links the server already stores, and only loads the
// YouTube player when the visitor presses play.
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
    <section className="relative px-6 py-14 md:px-8 lg:px-16 xl:px-20">
      <BlurCircle top="40px" left="-100px" />
      <p className="text-sm font-medium uppercase tracking-wider text-primary-dull">Watch</p>
      <h2 className="mt-1 text-2xl font-semibold md:text-3xl">Trailers</h2>

      <div className="relative mx-auto mt-8 aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
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
              className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/90 shadow-xl transition group-hover:scale-110 md:h-20 md:w-20">
              <PlayIcon className="h-7 w-7 fill-white md:h-9 md:w-9" />
            </span>
            <span className="absolute bottom-4 left-5 text-left text-lg font-semibold md:text-2xl">
              {current.movie.originalTitle}
            </span>
          </button>
        )}
      </div>

      <div className="mx-auto mt-4 flex max-w-5xl justify-end">
        <Link
          to={`/movies/${current.movie._id}`}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium transition hover:bg-primary-dull"
        >
          <TicketIcon className="h-4 w-4" /> Book {current.movie.originalTitle}
        </Link>
      </div>

      <div className="no-scrollbar mx-auto mt-6 flex max-w-5xl gap-3 overflow-x-auto pb-2">
        {trailers.map((t) => (
          <button
            key={t.movie._id}
            onClick={() => {
              setCurrentId(t.movie._id);
              setPlaying(true);
            }}
            className={`group relative aspect-video w-44 shrink-0 overflow-hidden rounded-lg ring-2 transition md:w-52 ${
              t.movie._id === current.movie._id ? 'ring-primary' : 'ring-transparent hover:ring-white/30'
            }`}
            aria-label={`Play trailer: ${t.movie.originalTitle}`}
          >
            <img src={thumb(t.id, 'mqdefault')} alt="" loading="lazy" className="h-full w-full object-cover brightness-75 group-hover:brightness-100" />
            <PlayIcon className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 fill-white" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4 text-left text-xs font-medium">
              {t.movie.originalTitle}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default MovieTrailer;
