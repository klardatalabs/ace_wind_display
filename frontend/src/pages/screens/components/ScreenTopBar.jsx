import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import LiveBadge from "../../../components/live/LiveBadge.jsx";
import MoodPill from "./MoodPill.jsx";

// The time of day is shown once, in the weather chip below this bar.
export default function ScreenTopBar({ skin, screenName, mood, statusStale=false, screenKey }) {
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
      </div>
    </header>
  );
}
