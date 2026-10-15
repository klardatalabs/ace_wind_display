// Between chapters on the students screen: a gust of wind. White streaks sweep across the
// screen, the 3D view (`layerRef`) softens for a moment and clears, and a small tag at the
// top names the chapter that's starting. Nothing covers the scene. Not on the first chapter
// after loading, and not at all when the viewer prefers reduced motion.

import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";

// Gentle S-curves across a 1600 × 900 frame, at different heights.
const STREAKS = [
  "M-100,170 C300,120 600,230 950,170 S1500,110 1750,160",
  "M-100,330 C250,290 650,380 1000,320 S1450,270 1750,320",
  "M-100,470 C350,430 700,520 1050,460 S1500,420 1750,470",
  "M-100,610 C300,570 600,660 950,600 S1450,560 1750,610",
  "M-100,760 C350,720 700,800 1050,750 S1500,710 1750,750",
];

export default function ChapterGust({ index, label, total, layerRef }) {
  const root = useRef(null);
  const first = useRef(true);

  useGSAP(
    () => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline();
      tl.set(root.current, { autoAlpha: 1 })
        .fromTo(".gust", { strokeDashoffset: 0.4 }, { strokeDashoffset: -1, duration: 1.1, stagger: 0.07, ease: "power2.inOut" }, 0)
        .fromTo(".gust-tag", { y: -24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: "back.out(2)" }, 0.15)
        .to(".gust-tag", { y: -16, autoAlpha: 0, duration: 0.4, ease: "power2.in" }, 2.1)
        .set(root.current, { autoAlpha: 0 });
      if (layerRef?.current) {
        tl.fromTo(layerRef.current, { filter: "blur(0px) brightness(1)" }, { filter: "blur(6px) brightness(1.08)", duration: 0.35, ease: "power1.in" }, 0.05)
          .to(layerRef.current, { filter: "blur(0px) brightness(1)", duration: 0.7, ease: "power2.out", clearProps: "filter" }, 0.4);
      }
    },
    { scope: root, dependencies: [index] }
  );

  return (
    <div ref={root} className="pointer-events-none invisible absolute inset-0 z-30 opacity-0" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="absolute inset-0 size-full">
        {STREAKS.map((d, i) => (
          <path key={i} className="gust" d={d} pathLength="1" fill="none" stroke="#fff" strokeOpacity={0.55 + (i % 2) * 0.25} strokeWidth={i % 2 ? 5 : 3} strokeLinecap="round" strokeDasharray="0.4 1.4" />
        ))}
      </svg>
      <p className="gust-tag absolute top-[3vmin] left-1/2 flex -translate-x-1/2 items-baseline gap-[1.2vmin] rounded-full bg-white/85 px-[2.6vmin] py-[1vmin] text-moss-950 shadow-[0_10px_30px_rgb(10_21_29/0.2)] ring-1 ring-white backdrop-blur-md">
        <span className="font-display text-[clamp(12px,1.8vmin,34px)] font-semibold text-moss-600 tabular-nums">
          {index + 1} / {total}
        </span>
        <span className="font-display text-[clamp(16px,2.6vmin,52px)] font-semibold">{label}</span>
      </p>
    </div>
  );
}
