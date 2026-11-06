import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from 'lucide-react';
import { youtubeId } from '../lib/api';

// Full-screen trailer player. The YouTube iframe (≈1 MB of scripts) is only
// created when someone actually wants to watch.
const TrailerModal = ({ url, title, onClose }) => {
  const id = youtubeId(url);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!id) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title || 'Movie'} trailer`}
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
          aria-label="Close trailer"
        >
          <XIcon className="h-5 w-5" /> Close
        </button>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
            title={`${title || 'Movie'} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TrailerModal;
