import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  StarIcon,
  TicketIcon,
} from 'lucide-react';
import { useAppContext } from '../context/Appcontext';
import { tmdbImage } from '../lib/api';
import { CURRENCY, formatNextShow, formatRuntime, languageLabel, releaseYear } from '../lib/format';
import TrailerModal from './TrailerModal';

const SLIDE_MS = 7000;
const MAX_SLIDES = 6;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Home hero: an auto-advancing, swipeable carousel of what's on sale right now.
// - Slides move sideways and loop seamlessly in both directions.
// - A story-style progress bar shows when the next slide comes; a pause button
//   stops it (WCAG 2.2.2). It also pauses while the text/buttons are hovered or
//   focused, when the tab is hidden, and while a trailer plays.
// - Only the current and next backdrops are downloaded up front.
const HeroSection = () => {
  const { shows } = useAppContext();
  const slides = useMemo(() => shows.filter((m) => m.backdrop).slice(0, MAX_SLIDES), [shows]);
  const count = slides.length;

  const [state, setState] = useState({ active: 0, prev: null, dir: 1 });
  const active = count ? state.active % count : 0;
  const [userPaused, setUserPaused] = useState(prefersReducedMotion);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [trailer, setTrailer] = useState(null);
  const [reach, setReach] = useState(1);
  const paused = userPaused || hoverPaused || focusPaused || tabHidden || !!trailer || count < 2;

  const goTo = useCallback(
    (target, dir) => {
      if (count < 2) return;
      const next = ((target % count) + count) % count;
      setState((s) => {
        const cur = s.active % count;
        if (next === cur) return s;
        return { active: next, prev: cur, dir: dir ?? (next > cur ? 1 : -1) };
      });
    },
    [count]
  );
  const next = useCallback(() => goTo(active + 1, 1), [goTo, active]);
  const prev = useCallback(() => goTo(active - 1, -1), [goTo, active]);

  useEffect(() => {
    setReach((r) => Math.max(r, active + 1));
  }, [active]);

  useEffect(() => {
    const onVis = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Swipe / drag
  const pointer = useRef(null);
  const onPointerDown = (e) => {
    pointer.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const p = pointer.current;
    pointer.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  };

  // Static fallback while the catalog loads (or if nothing has a backdrop)
  if (!count) {
    return (
      <section className="relative flex h-[88vh] min-h-[560px] w-full items-end overflow-hidden md:items-center">
        <picture>
          <source media="(max-width: 767px)" srcSet="/hero-bg-mobile.webp" />
          <img src="/hero-bg.webp" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
        <div className="relative z-10 w-full max-w-2xl animate-fade-in px-6 pb-24 md:px-14 md:pb-0 lg:px-24">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            From screen to seat <span className="text-brand">in seconds</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-gray-200">
            The latest movies in cinemas. Pick a show, choose your seats and pay securely.
          </p>
          <Link
            to="/movies"
            className="bg-brand mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold shadow-lg shadow-primary/30 transition hover:brightness-110"
          >
            Explore movies <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    );
  }

  const position = (i) => {
    if (i === active) return 0;
    if (count < 3) return null; // two slides: crossfade instead of sliding
    if (i === state.prev) return state.dir > 0 ? -100 : 100;
    const rel = (i - active + count) % count;
    if (rel === 1) return 100;
    if (rel === count - 1) return -100;
    return state.dir > 0 ? 100 : -100;
  };

  const upNext = [1, 2, 3].map((k) => slides[(active + k) % count]).filter((m, k, arr) => count > k + 1 && arr.indexOf(m) === k);

  return (
    <section
      className="group/hero relative h-[88vh] min-h-[600px] w-full overflow-hidden bg-ink-2 select-none"
      style={{ touchAction: 'pan-y' }}
      aria-roledescription="carousel"
      aria-label="Featured movies"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (pointer.current = null)}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.target.matches(':focus-visible') && setFocusPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocusPaused(false)}
    >
      <h1 className="sr-only">CineGo — book tickets for movies in cinemas now</h1>
      {slides.map((m, i) => {
        const x = position(i);
        const isActive = i === active;
        const moving = isActive || i === state.prev;
        const rel = (i - active + count) % count;
        const showImage = isActive || i <= reach || rel === 1;
        return (
          <div
            key={m._id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${m.originalTitle}`}
            aria-hidden={!isActive}
            inert={!isActive}
            className={`absolute inset-0 ${moving ? 'transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(.22,.8,.2,1)]' : ''} ${
              isActive ? 'z-20' : moving ? 'z-10' : 'z-0'
            }`}
            style={
              x === null
                ? { opacity: isActive ? 1 : 0 }
                : { transform: `translate3d(${x}%,0,0)`, visibility: moving || Math.abs(x) === 0 ? 'visible' : 'hidden' }
            }
          >
            <div className="absolute inset-0 overflow-hidden">
              {showImage && (
                <img
                  key={isActive ? `kb-${state.active}` : 'still'}
                  src={tmdbImage(m.backdrop, 'w1280')}
                  srcSet={`${tmdbImage(m.backdrop, 'w780')} 780w, ${tmdbImage(m.backdrop, 'w1280')} 1280w`}
                  sizes="100vw"
                  alt=""
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  draggable="false"
                  className={`h-full w-full object-cover object-[70%_center] ${isActive ? 'animate-ken-burns' : ''}`}
                />
              )}
            </div>

            {/* Light-touch scrims: just enough for legible text, the artwork stays bright */}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/35 to-transparent max-md:from-ink/60 max-md:via-ink/20" />
            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ink/70 to-transparent" />

            <div className="relative z-10 flex h-full items-end px-6 pb-32 md:items-center md:px-14 md:pb-10 lg:px-24">
              <div
                className="max-w-2xl"
                onMouseEnter={() => setHoverPaused(true)}
                onMouseLeave={() => setHoverPaused(false)}
              >
                <div className={`flex flex-wrap items-center gap-2 ${isActive ? 'animate-fade-in' : ''}`}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md ring-1 ring-white/15">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Now showing
                  </span>
                  {(m.genres || []).slice(0, 3).map((g) => (
                    <span key={g} className="rounded-full bg-black/25 px-3 py-1 text-xs text-gray-100 backdrop-blur-md ring-1 ring-white/10">
                      {g}
                    </span>
                  ))}
                </div>

                <h2
                  className={`mt-4 text-4xl font-extrabold leading-[1.02] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-7xl ${
                    isActive ? 'animate-fade-in [animation-delay:80ms]' : ''
                  }`}
                >
                  {m.originalTitle}
                </h2>
                {m.tagline && (
                  <p className={`mt-3 text-lg text-gray-100/90 md:text-xl ${isActive ? 'animate-fade-in [animation-delay:140ms]' : ''}`}>
                    {m.tagline}
                  </p>
                )}

                <div
                  className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-100 ${
                    isActive ? 'animate-fade-in [animation-delay:180ms]' : ''
                  }`}
                >
                  {m.averageRating > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-gold">
                      <StarIcon className="h-4 w-4 fill-gold" /> {Number(m.averageRating).toFixed(1)}
                    </span>
                  )}
                  {m.runtime > 0 && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" /> {formatRuntime(m.runtime)}
                    </span>
                  )}
                  {releaseYear(m.releaseDate) && <span>{releaseYear(m.releaseDate)}</span>}
                  {languageLabel(m.original_language) && <span>{languageLabel(m.original_language)}</span>}
                </div>

                <p
                  className={`mt-4 line-clamp-2 max-w-xl text-[15px] leading-relaxed text-gray-200 md:line-clamp-3 md:text-base ${
                    isActive ? 'animate-fade-in [animation-delay:220ms]' : ''
                  }`}
                >
                  {m.description}
                </p>

                <div className={`mt-7 flex flex-wrap items-center gap-3 ${isActive ? 'animate-fade-in [animation-delay:260ms]' : ''}`}>
                  <Link
                    to={`/movies/${m._id}`}
                    className="bg-brand flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold shadow-lg shadow-primary/30 transition hover:brightness-110 active:scale-[0.98]"
                  >
                    <TicketIcon className="h-5 w-5" /> Book tickets
                  </Link>
                  {m.trailer && (
                    <button
                      onClick={() => setTrailer(m)}
                      className="flex items-center gap-2 rounded-full bg-white/12 px-6 py-3.5 font-semibold ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20"
                    >
                      <PlayIcon className="h-5 w-5 fill-white" /> Trailer
                    </button>
                  )}
                  {(m.minPrice || m.nextShow) && (
                    <span className="text-sm text-gray-200 max-sm:w-full">
                      {m.minPrice ? (
                        <>
                          from <b className="text-white">{CURRENCY}{m.minPrice}</b>
                        </>
                      ) : null}
                      {m.minPrice && m.nextShow ? ' · ' : ''}
                      {m.nextShow ? `next ${formatNextShow(m.nextShow)}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Arrows */}
      {count > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous movie"
            className="absolute left-4 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 opacity-0 ring-1 ring-white/15 backdrop-blur-md transition hover:bg-black/50 focus-visible:opacity-100 group-hover/hero:opacity-100 md:flex"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <button
            onClick={next}
            aria-label="Next movie"
            className="absolute right-4 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 opacity-0 ring-1 ring-white/15 backdrop-blur-md transition hover:bg-black/50 focus-visible:opacity-100 group-hover/hero:opacity-100 md:flex"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Progress + pause, and "up next" thumbnails */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-20 z-30 flex items-end justify-between gap-6 px-6 md:bottom-24 md:px-14 lg:px-24">
          <div
            className="flex items-center gap-3"
            onMouseEnter={() => setHoverPaused(true)}
            onMouseLeave={() => setHoverPaused(false)}
          >
            <button
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/25"
            >
              {userPaused ? <PlayIcon className="h-4 w-4 fill-white" /> : <PauseIcon className="h-4 w-4 fill-white" />}
            </button>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose a featured movie">
              {slides.map((m, i) => (
                <button
                  key={m._id}
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Show ${m.originalTitle}`}
                  onClick={() => goTo(i)}
                  className={`relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all duration-300 hover:bg-white/40 ${
                    i === active ? 'w-12' : 'w-6'
                  }`}
                >
                  {i === active && (
                    <span
                      key={`p-${state.active}`}
                      className="animate-hero-progress bg-brand absolute inset-0 rounded-full"
                      style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                      onAnimationEnd={next}
                    />
                  )}
                </button>
              ))}
            </div>
            <span className="ml-1 text-xs font-medium tabular-nums text-gray-300">
              {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </span>
          </div>

          {upNext.length > 0 && (
            <div className="hidden items-end gap-3 lg:flex" aria-label="Up next">
              <span className="mb-1 mr-1 text-xs font-medium uppercase tracking-wider text-gray-300">Up next</span>
              {upNext.map((m) => (
                <button
                  key={m._id}
                  onClick={() => goTo(slides.indexOf(m), 1)}
                  className="group/thumb relative aspect-video w-40 overflow-hidden rounded-xl ring-1 ring-white/15 transition hover:-translate-y-1 hover:ring-white/40"
                  aria-label={`Show ${m.originalTitle}`}
                >
                  <img src={tmdbImage(m.backdrop, 'w300')} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover/thumb:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-1.5 pt-5 text-left text-xs font-semibold">
                    {m.originalTitle}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="sr-only" aria-live={paused ? 'polite' : 'off'}>
        {`Slide ${active + 1} of ${count}: ${slides[active]?.originalTitle || ''}`}
      </p>

      {trailer && <TrailerModal url={trailer.trailer} title={trailer.originalTitle} onClose={() => setTrailer(null)} />}
    </section>
  );
};

export default HeroSection;
