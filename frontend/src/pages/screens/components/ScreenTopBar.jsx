import { useEffect, useState } from "react";
import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import LiveBadge from "../../../components/live/LiveBadge.jsx";
import { Link } from "react-router";

// After this long without the mouse moving, the pointer and the exit button hide.
const IDLE_MS = 3000;

/**
 * Full screen, as on the live view. Browsers only allow full screen after a click, tap or
 * key press, so the screen goes full screen on the first scene interaction (for a kiosk that
 * should start full screen untouched, run the browser in kiosk mode: see the developer
 * page). In full screen the mouse pointer hides when still; moving it shows an exit button.
 * Hidden where the browser can't do full screen.
 */
function FullscreenControl({ skin }) {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement));
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    const update = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    if (!document.fullscreenEnabled) return () => document.removeEventListener("fullscreenchange", update);
    // Enter on the first interaction with the scene, not when following a control or link.
    const enter = (event) => {
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      if (event.target?.closest?.("a, button")) return;
      window.removeEventListener("pointerdown", enter);
      window.removeEventListener("keydown", enter);
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    };
    window.addEventListener("pointerdown", enter);
    window.addEventListener("keydown", enter);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      window.removeEventListener("pointerdown", enter);
      window.removeEventListener("keydown", enter);
    };
  }, []);

  // The pointer and the exit button show while the mouse moves, and hide when it rests.
  useEffect(() => {
    let timer;
    const wake = () => {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), IDLE_MS);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, []);
  useEffect(() => {
    document.documentElement.style.cursor = on && !awake ? "none" : "";
    return () => (document.documentElement.style.cursor = "");
  }, [on, awake]);

  if (!document.fullscreenEnabled) return null;
  const glass = skin.dark ? "bg-white/10 text-white ring-white/25" : "bg-white/70 text-moss-900 ring-moss-200";
  // (Stop the press reaching the "first interaction" listener, which would toggle it twice.)
  const press = (e) => e.stopPropagation();
  if (on) {
    return (
      <button
        type="button"
        onPointerDown={press}
        onClick={() => document.exitFullscreen().catch(() => {})}
        className={`pointer-events-auto flex cursor-pointer items-center gap-[0.8vmin] rounded-full px-[1.6vmin] py-[0.7vmin] text-[clamp(12px,1.5vmin,30px)] font-medium ring-1 backdrop-blur-md transition duration-300 hover:scale-105 active:scale-95 ${glass} ${awake ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <span aria-hidden="true">✕</span>
        Exit full screen
      </button>
    );
  }
  return (
    <button
      type="button"
      onPointerDown={press}
      onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
      title="Full screen"
      aria-label="Full screen"
      className={`pointer-events-auto grid size-[clamp(30px,3.6vmin,72px)] cursor-pointer place-items-center rounded-full text-[clamp(14px,1.9vmin,38px)] ring-1 backdrop-blur-md transition hover:scale-105 active:scale-95 ${glass}`}
    >
      <span aria-hidden="true">⛶</span>
    </button>
  );
}

// The time of day is shown once, in the weather chip below this bar; the top right keeps
// just the live badge and the full-screen button (no status pill).
export default function ScreenTopBar({ skin, screenName, screenKey }) {
  return (
    <header data-keepout className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-[2.2vmin] portrait:flex-col">
      <div className="flex items-center gap-[1.2vmin]">
        <TurbineMark className="size-[clamp(36px,4.6vmin,96px)]" />
        <div className="leading-tight">
          <p className={`font-display text-[clamp(18px,2.4vmin,48px)] font-bold tracking-display ${skin.text}`}>
            Weston<span className={skin.dark ? "text-moss-300" : "text-moss-500"}> Wind</span>
          </p>
          <p className={`text-[clamp(11px,1.3vmin,24px)] font-medium ${skin.muted}`}>{screenName} screen · Lawrence Weston, Bristol</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-[1vmin]">
        {screenKey === "college" && <Link to="/screen/college/seasons" onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }} className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-bold text-moss-900 shadow-lg ring-1 ring-moss-500/40 transition hover:bg-moss-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-300">Seasonal wind →</Link>}
        <Link to="/" onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }} className={`pointer-events-auto rounded-full px-[1.4vmin] py-[0.6vmin] text-[clamp(12px,1.3vmin,24px)] ring-1 ${skin.dark ? "bg-white/10 text-white ring-white/25" : "bg-white/70 text-moss-900 ring-moss-200"}`}>Home</Link>
        <LiveBadge tone={skin.dark ? "dark" : "light"} className="px-[1.4vmin]! py-[0.6vmin]! text-[clamp(11px,1.3vmin,24px)]!" />
        <FullscreenControl skin={skin} />
      </div>
    </header>
  );
}
