// What the visitor just tapped in the scene: a short description, a few live facts, and an
// "Ask Ace more" button that fetches a fuller answer (with photos) through the chatbot's
// web search. Items drawn as illustrations (estate, units, solar farm) say so.

import { useEffect, useRef, useState } from "react";
import { gsap } from "../../../lib/gsap.js";
import { HOTSPOTS } from "../../../three/hotspots.js";
import { askAce } from "../../../lib/askAce.js";
import { Markdown } from "../../../lib/markdown.jsx";
import { Credit } from "../../ask/components/PhotoStrip.jsx";
import Icon from "../../../components/ui/Icon.jsx";

export default function HotspotCard({ pick, ctx, screenKey, skin, onClose }) {
  const root = useRef(null);
  const [more, setMore] = useState({ state: "idle", text: "", photos: [], status: "" });
  const abort = useRef(null);
  const spot = pick ? HOTSPOTS[pick.id] : null;

  // a new tap starts fresh
  useEffect(() => {
    abort.current?.abort();
    setMore({ state: "idle", text: "", photos: [], status: "" });
    if (root.current && pick) gsap.fromTo(root.current, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
  }, [pick?.id, pick?.at]);
  useEffect(() => () => abort.current?.abort(), []);

  if (!pick || !spot) return null;
  const facts = spot.facts?.(ctx) ?? [];

  const ask = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setMore({ state: "loading", text: "", photos: [], status: "Asking Ace…" });
    try {
      await askAce(screenKey, spot.ask, {
        signal: controller.signal,
        onToken: (text) => setMore((m) => ({ ...m, state: "streaming", text })),
        onPhotos: (photos) => setMore((m) => ({ ...m, photos: [...m.photos, ...photos].slice(0, 3) })),
        onStatus: (status) => setMore((m) => ({ ...m, status })),
      });
      setMore((m) => ({ ...m, state: "done", status: "" }));
    } catch (err) {
      if (!controller.signal.aborted) setMore((m) => ({ ...m, state: "error", text: err.message }));
    }
  };

  return (
    <aside
      ref={root}
      className={`pointer-events-auto absolute z-30 flex max-h-[72vh] w-[min(40vmin,520px)] flex-col gap-[1.2vmin] overflow-y-auto rounded-[2.4vmin] p-[2.2vmin] landscape:top-[13vmin] landscape:right-[3vmin] portrait:inset-x-[3vmin] portrait:bottom-[30vmin] portrait:w-auto ${skin.card} backdrop-blur-xl`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-[1vmin]">
        <div>
          <p className={`text-[clamp(10px,1.3vmin,24px)] font-semibold tracking-[0.1em] uppercase ${skin.accent}`}>{spot.kicker}</p>
          <h2 className={`font-display text-[clamp(20px,3.2vmin,64px)] leading-tight font-semibold ${skin.text}`}>{spot.title}</h2>
        </div>
        <button type="button" onClick={onClose} className={`flex size-[4vmin] shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 ${skin.text}`} aria-label="Close">
          <Icon name="close" className="size-[2vmin]" />
        </button>
      </div>

      {spot.illustration && (
        <p className="w-fit rounded-full bg-amber-300/20 px-[1.2vmin] py-[0.3vmin] text-[clamp(10px,1.3vmin,24px)] font-medium text-amber-200">Illustration, not a survey</p>
      )}
      <p className={`text-[clamp(13px,1.8vmin,36px)] leading-snug ${skin.muted}`}>{spot.text}</p>

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-[1vmin]">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-[1.2vmin] bg-white/8 px-[1.2vmin] py-[0.8vmin]">
              <dt className={`text-[clamp(10px,1.2vmin,22px)] ${skin.muted}`}>{k}</dt>
              <dd className={`font-display text-[clamp(14px,2vmin,40px)] font-semibold tabular-nums ${skin.text}`}>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {more.state === "idle" ? (
        <button
          type="button"
          onClick={ask}
          className="flex items-center justify-center gap-[1vmin] rounded-full bg-moss-400 px-[2vmin] py-[1.1vmin] text-[clamp(13px,1.8vmin,36px)] font-semibold text-moss-950 hover:bg-moss-300"
        >
          <Icon name="commentDots" className="size-[1.2em]" />
          Ask Ace more
        </button>
      ) : (
        <div className={`flex flex-col gap-[1vmin] border-t border-white/10 pt-[1.2vmin] text-[clamp(13px,1.7vmin,34px)] leading-snug ${skin.text}`}>
          {more.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-[0.8vmin]">
              {more.photos.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-[1.2vmin]" style={{ backgroundColor: p.color }}>
                  <img src={p.thumb} alt={p.alt} className="aspect-[4/3] w-full object-cover" />
                  <figcaption className="px-[0.8vmin] py-[0.3vmin] text-[clamp(8px,1vmin,18px)] text-white/80">
                    <Credit photo={p} />
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {more.text ? <Markdown text={more.text} /> : <p className={skin.muted}>{more.status}</p>}
          {more.state === "streaming" && <p className={`text-[clamp(10px,1.2vmin,22px)] ${skin.muted}`}>{more.status}</p>}
        </div>
      )}
    </aside>
  );
}
