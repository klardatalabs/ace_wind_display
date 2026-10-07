import Icon from "../../../components/ui/Icon.jsx";
import { MOOD_LINES } from "../../../lib/mood.js";

const ICON = { storm: "wind", calm: "moon", fault: "cogs", maintenance: "cogs", curtailed: "plug", starting: "sun", generating: "bolt", connecting: "clock" };

export default function MoodPill({ mood, screenKey, skin }) {
  const line = MOOD_LINES[screenKey]?.[mood];
  if (!line) return null;
  return (
    <span
      className={`hidden items-center gap-[0.8vmin] rounded-full px-[1.4vmin] py-[0.6vmin] text-[clamp(11px,1.3vmin,24px)] font-medium md:inline-flex ${
        skin.dark ? "bg-white/10 text-white ring-1 ring-white/20 backdrop-blur" : "bg-white/80 text-moss-800 ring-1 ring-moss-100"
      }`}
    >
      <Icon name={ICON[mood] ?? "wind"} className="size-[1.2em]" />
      {line}
    </span>
  );
}
