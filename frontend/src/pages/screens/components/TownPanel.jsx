// "Our town" for the students screen: a scrapbook of Ambition Community Energy's own photos
// (their gallery), dropping onto the board one by one like taped-up polaroids, then the
// turbine's community facts counting up. Every figure is ACE's own
// (ambitioncommunityenergy.org): the community plan, the yearly homes figure and the
// lifetime carbon estimate.

import { useEffect, useRef, useState } from "react";
import { gsap } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import { formatInt } from "../../../lib/format.js";

// left / top / width are percentages of the board; each photo keeps its own shape.
const PHOTOS = [
  { src: "/images/ace/community.webp", caption: "Neighbours celebrating together", left: 0, top: 2, width: 35, tilt: -4 },
  { src: "/images/ace/ribbon-brunel.webp", caption: "Opening day: “Brunel” cuts the ribbon", left: 36, top: 0, width: 25, tilt: 3 },
  { src: "/images/ace/opening-crowd.webp", caption: "The crowd at my door", left: 63, top: 4, width: 36, tilt: -2 },
  { src: "/images/ace/climate-relay.webp", caption: "A climate relay baton came to me", left: 3, top: 36, width: 32, tilt: 3 },
  { src: "/images/ace/ace-team.webp", caption: "The ACE team on my site", left: 38, top: 34, width: 21, tilt: -3 },
  { src: "/images/ace/awards.webp", caption: "At the Green Energy Awards 2022", left: 63, top: 37, width: 33, tilt: 4 },
];

const FACTS = [
  { value: 1200, suffix: "+", text: "neighbours shared ideas for their area. A wind turbine was one." },
  { value: 3000, suffix: "+", text: "homes' worth of electricity, every year" },
  { value: 87600, suffix: " t", text: "of carbon dioxide kept out of the air over my life (ACE's estimate)" },
];

/** A number that counts up from zero once it appears. */
function CountUp({ to, delay, suffix }) {
  const [value, setValue] = useState(prefersReducedMotion() ? to : 0);
  const proxy = useRef({ v: 0 });
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const tween = gsap.to(proxy.current, { v: to, duration: 1.8, delay, ease: "power2.out", onUpdate: () => setValue(Math.round(proxy.current.v)) });
    return () => tween.kill();
  }, [to, delay]);
  return (
    <>
      {formatInt(value)}
      {suffix}
    </>
  );
}

const PHOTO_EVERY_S = 0.9;
const FACTS_AT_S = 0.6 + PHOTOS.length * PHOTO_EVERY_S + 1;

export default function TownPanel({ skin }) {
  return (
    <figure className="relative -mt-[7vh] h-[60vh] w-[56vw]">
      {PHOTOS.map((p, i) => (
        <div
          key={p.src}
          className="polaroid-drop absolute rounded-[0.8vmin] bg-white p-[0.7vmin] pb-[0.9vmin] shadow-[0_12px_34px_rgb(0_0_0/0.3)]"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, "--tilt": `${p.tilt}deg`, animationDelay: `${0.6 + i * PHOTO_EVERY_S}s` }}
        >
          <span className="absolute -top-[1.2vmin] left-1/2 h-[2.4vmin] w-[9vmin] -translate-x-1/2 rotate-[-3deg] bg-amber-100/80 shadow-sm" aria-hidden="true" />
          <img src={p.src} alt={p.caption} className="block max-h-[14vh] w-full rounded-[0.4vmin] object-cover" />
          <p className="mt-[0.6vmin] text-center text-[clamp(10px,1.45vmin,28px)] leading-tight font-medium text-moss-900">{p.caption}</p>
        </div>
      ))}
      <div
        className={`milestone-in absolute inset-x-[2%] top-[71%] grid grid-cols-3 gap-[2vmin] rounded-[2.4vmin] px-[2.2vmin] py-[1.6vmin] shadow-[0_24px_70px_rgb(10_21_29/0.35)] ${skin.card}`}
        style={{ animationDelay: `${FACTS_AT_S}s` }}
      >
        {FACTS.map((f, i) => (
          <div key={f.text} className="flex flex-col gap-[0.6vmin]">
            <span className={`font-display text-[clamp(20px,4vmin,80px)] leading-none font-semibold whitespace-nowrap tabular-nums ${skin.accent}`}>
              <CountUp to={f.value} delay={FACTS_AT_S + 0.2 + i * 0.3} suffix={f.suffix} />
            </span>
            <span className={`text-[clamp(11px,1.6vmin,30px)] leading-snug ${skin.text}`}>{f.text}</span>
          </div>
        ))}
        <figcaption className={`col-span-3 text-[clamp(9px,1.2vmin,22px)] ${skin.muted}`}>Photos and figures: Ambition Community Energy</figcaption>
      </div>
    </figure>
  );
}
