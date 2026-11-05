import { useEffect } from 'react';

const BRAND = '#4338CA';

// "https://www.youtube.com/watch?v=abc" or "https://youtu.be/abc" -> "abc"
export function youtubeId(url) {
  if (!url) return null;
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

export function mapsLink(name, city) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${city}`)}`;
}

// Popup that plays the official campus tour video inside Apply Hub
export default function VirtualTour({ institution, onClose }) {
  const id = youtubeId(institution?.tourVideoUrl);

  // Close with Escape and stop the page behind from scrolling
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!institution) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Virtual tour of ${institution.name}`}
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <div className="flex-1">
            <p className="font-semibold">{institution.name}</p>
            <p className="text-xs text-gray-500">Virtual campus tour · {institution.city}</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl px-2 text-gray-500 hover:text-gray-800" aria-label="Close the tour">
            ✕
          </button>
        </div>

        {id ? (
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
              title={`${institution.name} campus tour`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="p-6 text-gray-600">A tour video for this university has not been added yet.</p>
        )}

        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t text-sm">
          <a
            href={mapsLink(institution.name, institution.city)}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
            style={{ color: BRAND }}
          >
            Open in Google Maps
          </a>
          {institution.website && (
            <a href={institution.website} target="_blank" rel="noreferrer" className="font-medium underline" style={{ color: BRAND }}>
              Official website
            </a>
          )}
          <span className="text-xs text-gray-400 ml-auto">Video from the university's official channel on YouTube</span>
        </div>
      </div>
    </div>
  );
}