// The chapter text: eyebrow, headline (masked reveal), body and a big live figure.
// The parent keys this by chapter, so each chapter mounts fresh and animates in; live
// numbers then update in place. (No SplitText here: React owns the live text nodes.)

import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import StatCard from "./StatCard.jsx";

export default function StoryPanel({ chapter, data, skin }) {
  const root = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline()
        .from(".story-eyebrow", { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" })
        .from(".story-title-inner", { yPercent: 105, duration: 1.1, ease: "expo.out" }, "-=0.35")
        .from(".story-body", { y: 24, opacity: 0, duration: 0.8 }, "-=0.75")
        .from(".story-stat", { y: 30, opacity: 0, scale: 0.96, duration: 0.9, ease: "back.out(1.4)" }, "-=0.6");
    },
    { scope: root }
  );

  const stat = chapter.stat?.(data);
  return (
    <div ref={root} className="flex max-w-[min(46vw,1100px)] flex-col gap-[2vmin]">
      <p className={`story-eyebrow text-[clamp(13px,1.9vmin,36px)] font-semibold tracking-[0.06em] uppercase ${skin.accent}`}>{chapter.eyebrow}</p>
      <h1 className={`overflow-hidden pb-[0.12em] font-display text-[clamp(30px,6.4vmin,140px)] leading-[1.02] font-medium tracking-display text-balance ${skin.text}`}>
        <span className="story-title-inner block">{chapter.title(data)}</span>
      </h1>
      <p className={`story-body max-w-[40vw] text-[clamp(15px,2.3vmin,46px)] leading-snug ${skin.muted}`}>{chapter.body(data)}</p>
      {stat && <StatCard stat={stat} skin={skin} className="story-stat mt-[1vmin]" />}
    </div>
  );
}
