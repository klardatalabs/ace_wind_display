// ChatGPT-style photo rendering: adaptive 1/2/3/4 grid layout, shimmer skeleton loading,
// hover zoom effect with expand button, photographer credits and a full-screen lightbox.

import { useEffect, useRef, useState } from "react";
import { gsap } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import Icon from "../../../components/ui/Icon.jsx";

export function Credit({ photo, className = "" }) {
  return (
    <span className={`text-[11px] text-white/90 drop-shadow-sm ${className}`}>
      Photo by{" "}
      <a
        href={photo.authorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline decoration-white/50 underline-offset-2 hover:text-white hover:decoration-white"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.author}
      </a>{" "}
      on{" "}
      <a
        href={photo.unsplashUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline decoration-white/50 underline-offset-2 hover:text-white hover:decoration-white"
        onClick={(e) => e.stopPropagation()}
      >
        Unsplash
      </a>
    </span>
  );
}

function PhotoCard({ photo, onOpen, aspect = "aspect-[4/3]", className = "" }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <figure
      onClick={() => onOpen(photo)}
      className={`group relative overflow-hidden rounded-2xl ring-1 ring-black/10 select-none cursor-pointer transition-shadow duration-300 hover:shadow-lg ${aspect} ${className}`}
      style={{ backgroundColor: photo.color || "#0b1822" }}
    >
      {/* Shimmer skeleton while loading */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-white/10" aria-hidden="true" />
      )}

      {/* Image with hover zoom */}
      <img
        src={photo.thumb}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`size-full object-cover transition-all duration-700 ease-out group-hover:scale-105 ${
          loaded ? "opacity-100" : "scale-105 opacity-0 blur-sm"
        }`}
      />

      {/* Subtle hover gradient wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-95" />

      {/* Top right zoom icon on hover */}
      <div className="pointer-events-none absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 scale-90">
        <Icon name="eye" className="size-4" />
      </div>

      {/* Bottom caption / attribution */}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2">
        <div className="pointer-events-auto truncate">
          <Credit photo={photo} />
        </div>
      </figcaption>
    </figure>
  );
}

function Lightbox({ photo, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    if (!prefersReducedMotion()) {
      gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      gsap.fromTo(
        ref.current.querySelector(".lightbox-dialog"),
        { scale: 0.94, y: 16 },
        { scale: 1, y: 0, duration: 0.4, ease: "back.out(1.4)" }
      );
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="lightbox-dialog relative flex max-h-[92vh] max-w-4xl flex-col items-center overflow-hidden rounded-3xl bg-moss-950/90 p-3 ring-1 ring-white/15 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 backdrop-blur"
        >
          ✕
        </button>

        <div className="relative max-h-[78vh] w-full overflow-hidden rounded-2xl flex items-center justify-center">
          <img
            src={photo.regular}
            alt={photo.alt}
            className="max-h-[78vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>

        <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-3 px-2 text-sm text-white/85">
          <Credit photo={photo} className="text-xs sm:text-sm" />
          <a
            href={photo.page}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/25"
          >
            View on Unsplash ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PhotoStrip({ photos, className = "" }) {
  const [open, setOpen] = useState(null);
  if (!photos?.length) return null;

  const count = photos.length;

  return (
    <div className={`w-full ${className}`}>
      {/* 1 Photo: Hero banner card */}
      {count === 1 && (
        <PhotoCard
          photo={photos[0]}
          onOpen={setOpen}
          aspect="aspect-[16/10] sm:aspect-[16/9]"
          className="w-full"
        />
      )}

      {/* 2 Photos: 2-column side-by-side grid */}
      {count === 2 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <PhotoCard photo={photos[0]} onOpen={setOpen} aspect="aspect-[4/3]" />
          <PhotoCard photo={photos[1]} onOpen={setOpen} aspect="aspect-[4/3]" />
        </div>
      )}

      {/* 3 Photos: 1 wide top + 2 columns underneath */}
      {count === 3 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <PhotoCard
            photo={photos[0]}
            onOpen={setOpen}
            aspect="aspect-[16/9]"
            className="col-span-2"
          />
          <PhotoCard photo={photos[1]} onOpen={setOpen} aspect="aspect-[4/3]" />
          <PhotoCard photo={photos[2]} onOpen={setOpen} aspect="aspect-[4/3]" />
        </div>
      )}

      {/* 4+ Photos: Clean 2x2 grid */}
      {count >= 4 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {photos.slice(0, 4).map((p) => (
            <PhotoCard key={p.id} photo={p} onOpen={setOpen} aspect="aspect-[4/3]" />
          ))}
        </div>
      )}

      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
