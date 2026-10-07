// Small "LIVE · 1.24 MW" pill with a pulsing dot. Says DEMO when the admin is simulating.

import { useLive } from "../../store/useLiveStore.js";
import { formatPower } from "../../lib/format.js";

export default function LiveBadge({ className = "", tone = "light" }) {
  const { ready, mode, connected, powerKw } = useLive();
  const p = formatPower(powerKw);
  const label = mode === "simulate" ? "DEMO" : connected ? "LIVE" : "LAST KNOWN";
  const dark = tone === "dark";
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
        dark ? "bg-white/10 text-white ring-1 ring-white/20" : "bg-moss-50 text-moss-700 ring-1 ring-moss-100"
      } ${className}`}
    >
      <span className="relative flex size-2">
        <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${dark ? "bg-moss-300" : "bg-moss-400"}`} />
        <span className={`relative inline-flex size-2 rounded-full ${dark ? "bg-moss-300" : "bg-moss-500"}`} />
      </span>
      {label}
      {ready && (
        <span className="font-mono tabular-nums">
          {p.value} {p.unit}
        </span>
      )}
    </span>
  );
}
