// A strip of photographs above Ace's reply. Tap one to see it large. Every photo carries the
// photographer's name and Unsplash credit, with links, as Unsplash's guidelines require.

import { useEffect, useRef, useState } from "react";
import { gsap } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";

export function Credit({ photo, className = "" }) {
  return (
    <span className={className}>
      Photo by{" "}
      <a href={photo.authorUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/50 underline-offset-2">
        {photo.author}
      </a>{" "}
      on{" "}
      <a href={photo.unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/50 underline-offset-2">
        Unsplash
      </a>
    </span>
  );
}

function Tile({ photo, onOpen, single }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <figure
      className={`relative shrink-0 snap-center overflow-hidden rounded-2xl ring-1 ring-moss-100 ${single ? "w-full" : "w-[72%] sm:w-[46%]"}`}
      style={{ backgroundColor: photo.color, aspectRatio: single ? "16 / 10" : "4 / 3" }}
    >
      <button type="button" onClick={() => onOpen(photo)} className="absolute inset-0 block size-full cursor-zoom-in" aria-label={`Enlarge photo: ${photo.alt}`}>
        <img
          src={photo.thumb}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`size-full object-cover transition-[opacity,transform] duration-700 ${loaded ? "scale-100 opacity-100" : "scale-105 opacity-0"}`}
        />
      </button>
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pt-6 pb-1.5 text-[10px] text-white/90">
        <span className="pointer-events-auto">
          <Credit photo={photo} />
        </span>
      </figcaption>
    </figure>
  );
}

function Lightbox({ photo, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    if (!prefersReducedMotion()) {
      gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      gsap.fromTo(ref.current.querySelector("figure"), { scale: 0.92, y: 16 }, { scale: 1, y: 0, duration: 0.45, ease: "back.out(1.4)" });
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={photo.alt} className="fixed inset-0 z-50 flex items-center justify-center bg-moss-950/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <figure className="max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <img src={photo.regular} alt={photo.alt} className="max-h-[78dvh] w-full rounded-2xl object-contain shadow-2xl" />
        <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-white/85">
          <Credit photo={photo} />
          <a href={photo.page} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25">
            View on Unsplash
          </a>
        </figcaption>
      </figure>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25">
        ×
      </button>
    </div>
  );
}

export default function PhotoStrip({ photos }) {
  const [open, setOpen] = useState(null);
  if (!photos?.length) return null;
  return (
    <>
      <div className="no-scrollbar -mx-1 mb-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {photos.map((p) => (
          <Tile key={p.id} photo={p} onOpen={setOpen} single={photos.length === 1} />
        ))}
      </div>
      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
    </>
  );
}
