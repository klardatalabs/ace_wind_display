// Small "LIVE · 1.24 MW" pill with a pulsing dot. Says DEMO when the server is simulating.

import { useLive } from "../../store/useLiveStore.js";
import { formatPower } from "../../lib/format.js";

function ageOf(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

export default function LiveBadge({ className = "", tone = "light" }) {
  const { ready, mode, connected, liveAt, powerKw } = useLive();
  const fresh = connected;
  const p = formatPower(powerKw);
  const label = mode === "simulate" ? "DEMO" : fresh ? "LIVE" : liveAt ? `LAST KNOWN · ${ageOf(liveAt)}` : "SAMPLE DATA";
  const dark = tone === "dark";
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
        dark ? "bg-white/10 text-white ring-1 ring-white/20" : "bg-moss-50 text-moss-700 ring-1 ring-moss-100"
      } ${className}`}
    >
      <span className="relative flex size-2">
        {(fresh || mode === "simulate") && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${dark ? "bg-moss-300" : "bg-moss-400"}`} />}
        <span className={`relative inline-flex size-2 rounded-full ${dark ? "bg-moss-300" : "bg-moss-500"}`} />
      </span>
      {label}
      {ready && (fresh || mode === "simulate" || liveAt) && (
        <span className="font-mono tabular-nums">
          {p.value} {p.unit}
        </span>
      )}
    </span>
  );
}
