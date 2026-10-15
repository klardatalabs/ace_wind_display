// "A day here": a running clock over the time-lapse, and the day told in six moments, each
// closed with what the turbine really did at that hour (content/dayStory.js).

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import { api } from "../../../lib/api.js";
import { dayMoment, lapseHour } from "../../../content/dayStory.js";

export function useDayHistory() {
  const [history, setHistory] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.history(24).then((h) => alive && setHistory(h)).catch(() => {});
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return history;
}

/** `compact` sits the day in a small card (college) instead of across the open scene. */
export default function DayStory({ audience, elapsedS, skin, compact = false }) {
  const history = useDayHistory();
  const moment = dayMoment(audience, lapseHour(elapsedS), history);
  return (
    <div className={`flex flex-col portrait:max-w-full ${compact ? "max-w-[min(34vw,760px)] gap-[1vmin]" : "max-w-[min(62vw,1500px)] gap-[1.4vmin]"}`}>
      <p className={`font-mono leading-none ${compact ? "text-[clamp(22px,4.4vmin,90px)]" : "text-[clamp(28px,7vmin,150px)]"} font-semibold tabular-nums ${skin.text} ${skin.dark ? "[text-shadow:0_2px_30px_rgb(0_0_0/0.45)]" : ""}`}>{moment.clock}</p>
      <Moment key={moment.key} moment={moment} skin={skin} compact={compact} />
    </div>
  );
}

function Moment({ moment, skin, compact }) {
  const root = useRef(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline()
        .from(".day-eyebrow", { y: 12, opacity: 0, duration: 0.45 })
        .from(".day-line", { y: 18, opacity: 0, duration: 0.6, ease: "expo.out" }, "-=0.25")
        .from(".day-sub", { y: 12, opacity: 0, duration: 0.5 }, "-=0.3");
    },
    { scope: root }
  );
  return (
    <div ref={root} className="flex flex-col gap-[1.2vmin]">
      <p className={`day-eyebrow flex items-center gap-[1vmin] text-[clamp(12px,1.7vmin,32px)] font-semibold tracking-[0.12em] uppercase ${skin.accent}`}>
        <span className="h-px w-[4vmin] bg-current opacity-70" />
        {moment.eyebrow}
      </p>
      <h1 className={`day-line font-display leading-[1.08] ${compact ? "text-[clamp(18px,3vmin,64px)]" : "text-[clamp(26px,5vmin,110px)]"} font-medium tracking-display text-balance ${skin.text} ${skin.dark ? "[text-shadow:0_2px_30px_rgb(0_0_0/0.45)]" : ""}`}>{moment.line}</h1>
      <p className={`day-sub leading-snug ${compact ? "text-[clamp(12px,1.8vmin,36px)]" : "max-w-[min(48vw,900px)] text-[clamp(14px,2.1vmin,42px)]"} ${skin.muted} ${skin.dark ? "[text-shadow:0_1px_16px_rgb(0_0_0/0.5)]" : ""} portrait:max-w-full`}>{moment.sub}</p>
    </div>
  );
}
