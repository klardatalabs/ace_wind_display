// "A day here": a running clock over the time-lapse, and the day told in six moments, each
// closed with what the turbine really did at that hour (content/dayStory.js).

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import { api } from "../../../lib/api.js";
import { dayMoment, lapseHour } from "../../../content/dayStory.js";

function useDayHistory() {
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

export default function DayStory({ audience, elapsedS, skin }) {
  const history = useDayHistory();
  const moment = dayMoment(audience, lapseHour(elapsedS), history);
  return (
    <div className="flex max-w-[min(62vw,1500px)] flex-col gap-[1.4vmin] portrait:max-w-full">
      <p className={`font-mono text-[clamp(28px,7vmin,150px)] leading-none font-semibold tabular-nums ${skin.text} [text-shadow:0_2px_30px_rgb(0_0_0/0.45)]`}>{moment.clock}</p>
      <Moment key={moment.key} moment={moment} skin={skin} />
    </div>
  );
}

function Moment({ moment, skin }) {
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
      <h1 className={`day-line font-display text-[clamp(26px,5vmin,110px)] leading-[1.05] font-medium tracking-display text-balance ${skin.text} [text-shadow:0_2px_30px_rgb(0_0_0/0.45)]`}>{moment.line}</h1>
      <p className={`day-sub max-w-[min(48vw,900px)] text-[clamp(14px,2.1vmin,42px)] leading-snug ${skin.muted} [text-shadow:0_1px_16px_rgb(0_0_0/0.5)] portrait:max-w-full`}>{moment.sub}</p>
    </div>
  );
}
