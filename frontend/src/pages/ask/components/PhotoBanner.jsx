// A band of photographs across the top of the chat page: three tiles that slowly drift and
// swap, using Unsplash pictures of wind power in the landscape. Hidden if photos aren't available.

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import { api } from "../../../lib/api.js";

const KEY = "ww.banner.photos";
const TTL_MS = 60 * 60 * 1000;
const TILES = 3;

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return c && Date.now() - c.at < TTL_MS ? c.photos : null;
  } catch {
    return null;
  }
}

export default function PhotoBanner({ query = "wind turbines countryside sunrise" }) {
  const [photos, setPhotos] = useState(() => readCache() || []);
  const [offset, setOffset] = useState(0);
  const root = useRef(null);

  useEffect(() => {
    if (photos.length) return undefined;
    let alive = true;
    api
      .photos(query, 6)
      .then((r) => {
        if (!alive || !r.photos?.length) return;
        setPhotos(r.photos);
        try {
          sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), photos: r.photos }));
        } catch {
          // fine without the cache
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [photos.length, query]);

  // Every few seconds one tile moves on to the next picture.
  useEffect(() => {
    if (photos.length <= TILES || prefersReducedMotion()) return undefined;
    const id = setInterval(() => setOffset((o) => o + 1), 5200);
    return () => clearInterval(id);
  }, [photos.length]);

  useGSAP(
    () => {
      if (!photos.length || prefersReducedMotion()) return;
      gsap.from(".banner-tile", { opacity: 0, y: 14, stagger: 0.12, duration: 0.9, ease: "power3.out" });
      gsap.to(".banner-tile img", { scale: 1.08, duration: 14, ease: "none", repeat: -1, yoyo: true, stagger: 2 });
    },
    { scope: root, dependencies: [photos.length] }
  );

  if (!photos.length) return null;
  const shown = Array.from({ length: Math.min(TILES, photos.length) }, (_, i) => photos[(i + offset) % photos.length]);
  return (
    <div ref={root} className="bg-moss-950 px-2 pt-2 pb-1.5">
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-1.5">
        {shown.map((p, i) => (
          <figure key={`${i}-${p.id}`} className="banner-tile relative aspect-[4/3] overflow-hidden rounded-xl" style={{ backgroundColor: p.color }}>
            <img src={p.thumb} alt={p.alt} decoding="async" className="size-full object-cover" />
          </figure>
        ))}
      </div>
      <p className="mx-auto mt-1 max-w-2xl truncate text-center text-[10px] text-white/55">
        Photos by{" "}
        {shown.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ", "}
            <a href={p.authorUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-2">
              {p.author}
            </a>
          </span>
        ))}{" "}
        on{" "}
        <a href={shown[0].unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-2">
          Unsplash
        </a>
      </p>
    </div>
  );
}
