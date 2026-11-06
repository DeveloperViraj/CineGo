// Purpose: Small display helpers shared across pages.

export const CURRENCY = import.meta.env.VITE_CURRENCY || '₹';

export const SEAT_HOLD_MINUTES = Number(import.meta.env.VITE_SEAT_HOLD_MINUTES) || 10;

export function formatRuntime(minutes) {
  const m = Number(minutes) || 0;
  if (!m) return '';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h ? `${h}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}

export function releaseYear(releaseDate) {
  const y = new Date(releaseDate).getFullYear();
  return Number.isFinite(y) ? y : '';
}

// "YYYY-MM-DD" -> Date at local midnight (avoids the UTC off-by-one of new Date("YYYY-MM-DD"))
export const parseDay = (ymd) => new Date(`${ymd}T00:00:00`);

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function dayLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

export const formatTime = (date) =>
  new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

export const formatDateLong = (date) =>
  new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function formatNextShow(date) {
  if (!date) return '';
  const d = new Date(date);
  const label = dayLabel(d);
  const day = ['Today', 'Tomorrow'].includes(label)
    ? label
    : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${formatTime(d)}`;
}

export function formatDateTime(date) {
  return `${formatDateLong(date)} • ${formatTime(date)}`;
}

export function compactNumber(n) {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);
}

export function languageLabel(langs) {
  const list = Array.isArray(langs) ? langs : [langs];
  const names = list.filter(Boolean).map((l) => {
    if (/^[a-z]{2}$/i.test(l)) {
      try {
        return new Intl.DisplayNames(['en'], { type: 'language' }).of(l);
      } catch {
        return l;
      }
    }
    return l;
  });
  return names.slice(0, 3).join(', ');
}
