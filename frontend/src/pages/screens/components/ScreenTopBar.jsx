import { useEffect, useState } from "react";
import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import LiveBadge from "../../../components/live/LiveBadge.jsx";
import MoodPill from "./MoodPill.jsx";

/** Full screen on and off, as on the live view; hidden where the browser can't do it. */
function FullscreenButton({ skin }) {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const update = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  if (!document.fullscreenEnabled) return null;
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  return (
    <button
      type="button"
      onClick={toggle}
      title={on ? "Exit full screen" : "Full screen"}
      aria-label={on ? "Exit full screen" : "Full screen"}
      className={`pointer-events-auto grid size-[clamp(30px,3.6vmin,72px)] place-items-center rounded-full text-[clamp(14px,1.9vmin,38px)] ring-1 backdrop-blur-md transition hover:scale-105 active:scale-95 ${on ? "opacity-40 hover:opacity-100" : ""} ${skin.dark ? "bg-white/10 text-white ring-white/25" : "bg-white/70 text-moss-900 ring-moss-200"}`}
    >
      <span aria-hidden="true">⛶</span>
    </button>
  );
}

// The time of day is shown once, in the weather chip below this bar.
export default function ScreenTopBar({ skin, screenName, mood, statusStale = false, screenKey }) {
  return (
    <header data-keepout className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-6 p-[2.2vmin]">
      <div className="flex items-center gap-[1.2vmin]">
        <TurbineMark className="size-[clamp(36px,4.6vmin,96px)]" />
        <div className="leading-tight">
          <p className={`font-display text-[clamp(18px,2.4vmin,48px)] font-bold tracking-display ${skin.text}`}>
            Weston<span className={skin.dark ? "text-moss-300" : "text-moss-500"}> Wind</span>
          </p>
          <p className={`text-[clamp(11px,1.3vmin,24px)] font-medium ${skin.muted}`}>{screenName} screen · Lawrence Weston, Bristol</p>
        </div>
      </div>
      <div className="flex items-center gap-[1vmin]">
        <MoodPill mood={mood} stale={statusStale} screenKey={screenKey} skin={skin} />
        <LiveBadge tone={skin.dark ? "dark" : "light"} className="px-[1.4vmin]! py-[0.6vmin]! text-[clamp(11px,1.3vmin,24px)]!" />
        <FullscreenButton skin={skin} />
      </div>
    </header>
  );
}
