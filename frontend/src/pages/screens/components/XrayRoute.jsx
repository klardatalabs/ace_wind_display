// The X-ray climb's route (college "Go inside"): a technician's way up drawn as a gauge,
// from the bottom of the foundation to the blade tip, with the stops along it and a dot
// that rises to the one the camera is at. Heights are the sourced ones: the foundation
// 22 m deep, the tower 92 m, the tip 150 m.

import { XRAY_STOPS } from "../../../three/xrayStops.js";

const NAMES = { ground: "Foundation", base: "Tower base", lower: "The climb", middle: "Mid-tower", top: "Tower top", nacelle: "Nacelle", hub: "Rotor" };
const MARKS = [
  [150, "150 m · blade tip"],
  [92, "92 m · tower"],
  [0, "0 m · ground"],
  [-22, "−22 m · foundation"],
];
const LOW = -22;
const HIGH = 150;
const at = (h) => `${(((HIGH - h) / (HIGH - LOW)) * 100).toFixed(2)}%`;

export default function XrayRoute({ stop, skin }) {
  const current = XRAY_STOPS[stop] ?? XRAY_STOPS[0];
  // Lines and dots in the skin's ink, so they read on white paper as well as over a scene.
  const ink = skin.dark ? { line: "bg-white/60", track: "bg-white/25", dot: "bg-white/40" } : { line: "bg-moss-950/50", track: "bg-moss-950/15", dot: "bg-moss-950/30" };
  return (
    <aside data-keepout className={`pointer-events-none absolute top-[16vmin] right-[3vmin] z-10 flex w-[min(24vw,420px)] flex-col gap-[2vmin] rounded-[2.4vmin] p-[2.2vmin] ${skin.card}`}>
      <div>
        <p className={`font-mono text-[clamp(10px,1.35vmin,26px)] tracking-[0.12em] uppercase ${skin.accent}`}>Technician's route · {stop + 1} of {XRAY_STOPS.length}</p>
        <p key={current.id} className={`milestone-in font-display text-[clamp(18px,3vmin,60px)] leading-tight font-semibold ${skin.text}`}>{NAMES[current.id]}</p>
      </div>
      <div className="flex gap-[2vmin]">
      <div className="relative h-[42vh] w-[2.4vmin] shrink-0">
        {/* The ground line, and the shaft of the route */}
        <span className={`absolute inset-x-0 h-px ${ink.line}`} style={{ top: at(0) }} />
        <span className={`absolute top-0 bottom-0 left-1/2 w-[0.3vmin] -translate-x-1/2 rounded-full ${ink.track}`} />
        <span className="absolute left-1/2 w-[0.3vmin] -translate-x-1/2 rounded-full bg-moss-400 transition-[top] duration-[2400ms] ease-in-out" style={{ top: at(current.height), bottom: 0 }} />
        {XRAY_STOPS.map((s, i) => (
          <span
            key={s.id}
            className={`absolute left-1/2 block size-[1.2vmin] -translate-x-1/2 -translate-y-1/2 rounded-full ${i <= stop ? "bg-moss-400" : ink.dot}`}
            style={{ top: at(s.height) }}
          />
        ))}
        <span
          className="absolute left-1/2 block size-[2.4vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_rgb(111_220_156/0.9)] ring-[0.5vmin] ring-moss-400 transition-[top] duration-[2400ms] ease-in-out"
          style={{ top: at(current.height) }}
        />
      </div>
      <div className="relative h-[42vh] flex-1">
        {MARKS.map(([h, text]) => (
          <p key={h} className={`absolute -translate-y-1/2 font-mono text-[clamp(10px,1.35vmin,26px)] whitespace-nowrap ${skin.muted}`} style={{ top: at(h) }}>
            {text}
          </p>
        ))}
      </div>
      </div>
    </aside>
  );
}
