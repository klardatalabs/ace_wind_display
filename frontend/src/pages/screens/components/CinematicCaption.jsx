// The story, told like a film's lower third: a small eyebrow, a headline whose words rise
// in one by one, and a quieter line beneath. The parent keys this by chapter so it replays
// for each one. The headline's words are React spans (so live figures can change under it);
// GSAP only animates their position and opacity.

import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";

export default function CinematicCaption({ chapter, data, skin }) {
  const root = useRef(null);
  const words = chapter.line(data).split(" ");

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline()
        .from(".cap-eyebrow", { y: 14, opacity: 0, duration: 0.6 })
        .from(".cap-word", { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.055, ease: "expo.out" }, "-=0.3")
        .from(".cap-sub", { y: 16, opacity: 0, duration: 0.8 }, "-=0.45");
    },
    { scope: root }
  );

  return (
    <div ref={root} className="flex max-w-[min(62vw,1500px)] flex-col gap-[1.4vmin] portrait:max-w-full">
      <p className={`cap-eyebrow flex items-center gap-[1vmin] text-[clamp(12px,1.7vmin,32px)] font-semibold tracking-[0.12em] uppercase ${skin.accent}`}>
        <span className="h-px w-[4vmin] bg-current opacity-70" />
        {chapter.eyebrow}
      </p>
      <h1 className={`font-display text-[clamp(30px,6.2vmin,130px)] leading-[1.04] font-medium tracking-display text-balance ${skin.text} [text-shadow:0_2px_30px_rgb(0_0_0/0.45)]`}>
        {words.map((w, i) => (
          <span key={`${i}-${w}`} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
            <span className="cap-word inline-block">{w}&nbsp;</span>
          </span>
        ))}
      </h1>
      <p className={`cap-sub max-w-[46vmin] text-[clamp(14px,2.1vmin,42px)] leading-snug ${skin.muted} [text-shadow:0_1px_16px_rgb(0_0_0/0.5)] landscape:max-w-[min(48vw,900px)]`}>{chapter.sub(data)}</p>
    </div>
  );
}
