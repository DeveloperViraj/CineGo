import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SectionHeader from './SectionHeader';
import { useAppContext } from '../context/Appcontext';
import { tmdbImage } from '../lib/api';

// "Browse by genre": one tile per popular genre, using the top movie's backdrop.
const GenreTiles = () => {
  const { shows } = useAppContext();

  const tiles = useMemo(() => {
    const count = new Map();
    shows.forEach((m) => (m.genres || []).forEach((g) => count.set(g, (count.get(g) || 0) + 1)));
    const used = new Set();
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, n]) => {
        const inGenre = shows.filter((m) => m.backdrop && (m.genres || []).includes(genre));
        const cover = inGenre.find((m) => !used.has(m._id)) || inGenre[0];
        if (cover) used.add(cover._id);
        return { genre, n, cover };
      })
      .filter((t) => t.cover);
  }, [shows]);

  if (tiles.length < 3) return null;

  return (
    <section className="px-6 py-10 md:px-14 lg:px-24">
      <SectionHeader eyebrow="Explore" title="Browse by genre" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {tiles.map(({ genre, n, cover }) => (
          <Link
            key={genre}
            to={`/movies?genre=${encodeURIComponent(genre)}`}
            className="group relative aspect-[16/9] overflow-hidden rounded-2xl ring-1 ring-line"
          >
            <img
              src={tmdbImage(cover.backdrop, 'w780')}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5 transition group-hover:from-primary/70" />
            <div className="absolute inset-x-0 bottom-0 p-3 md:p-5">
              <p className="text-lg font-bold md:text-2xl">{genre}</p>
              <p className="text-xs text-gray-200 md:text-sm">
                {n} movie{n === 1 ? '' : 's'} showing
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default GenreTiles;
