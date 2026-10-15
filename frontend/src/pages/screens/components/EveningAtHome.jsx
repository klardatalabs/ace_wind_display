// The community screen's ending to the energy journey: an evening in Lawrence Weston. Dusk
// falls on a terraced street, the street lamp flickers on and the windows light up one by
// one; an electric car pulls up to a street charger, the cable goes in and power pulses
// along it. A counter shows how many miles an electric car could drive on each minute of
// the turbine's output right now (lib/impact.js, 0.3 kWh a mile). Then coins roll from the
// turbine into the estate, because the money it earns goes back into Lawrence Weston
// (ACE's own words).

import { formatInt } from "../../../lib/format.js";
import { evMiles } from "../../../lib/impact.js";

// A terrace of five houses: x of each house's left edge, and its roof colour.
const HOUSES = [
  [6, "#7c2d12"],
  [48, "#9a3412"],
  [90, "#7c2d12"],
  [132, "#9a3412"],
  [174, "#7c2d12"],
];
// The charging cable, from the charger's socket to the car's charge port.
const CABLE = "M297,108 C292,126 280,130 271,121";

export default function EveningAtHome({ data, skin }) {
  const milesPerMinute = evMiles(data.powerKw / 60);
  return (
    <aside className={`milestone-in pointer-events-none absolute top-[16vmin] right-[3vmin] z-10 flex w-[min(36vw,680px)] flex-col gap-[1.6vmin] rounded-[2.6vmin] p-[2.2vmin] ${skin.card}`}>
      {/* Dusk on a terraced street: the lamp, the windows, then a car plugging in */}
      <svg viewBox="0 0 320 150" className="block w-full overflow-hidden rounded-[1.6vmin]" aria-hidden="true">
        <defs>
          <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e1b4b" />
            <stop offset="0.6" stopColor="#7c3aed" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <rect width="320" height="150" fill="url(#dusk)" />
        {[[30, 18], [120, 12], [200, 24], [168, 8], [260, 16], [300, 30]].map(([x, y], i) => (
          <circle key={i} className="home-star" cx={x} cy={y} r="1.3" fill="#fff" style={{ animationDelay: `${0.6 + i * 0.35}s` }} />
        ))}
        {HOUSES.map(([x, roof], i) => (
          <g key={x}>
            <path d={`M${x},74 L${x + 21},54 L${x + 42},74 Z`} fill={roof} />
            <rect x={x} y="74" width="42" height="56" fill="#c2410c" stroke="#431407" strokeWidth="1.5" />
            <rect x={x + 6} y="82" width="12" height="14" className="home-window" fill="#fde68a" style={{ animationDelay: `${1.2 + i * 0.45}s` }} />
            <rect x={x + 24} y="82" width="12" height="14" className="home-window" fill="#fde68a" style={{ animationDelay: `${1.45 + ((i * 3) % 5) * 0.4}s` }} />
            <rect x={x + 15} y="106" width="12" height="24" fill="#431407" />
          </g>
        ))}

        {/* The street lamp */}
        <circle className="home-glow" cx="226" cy="74" r="16" fill="#fde68a" />
        <rect x="224" y="76" width="3" height="54" fill="#1f2937" />
        <rect x="219" y="71" width="13" height="5" rx="2" fill="#1f2937" />

        {/* The road and pavement */}
        <rect y="130" width="320" height="20" fill="#334155" />
        <rect y="128" width="320" height="3" fill="#64748b" />
        <path d="M0,142 H320" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="10 8" />

        {/* The street charger: its screen shows a bolt once the car is plugged in */}
        <rect x="292" y="94" width="14" height="36" rx="2.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.5" />
        <rect x="295" y="98" width="8" height="7" rx="1" fill="#0f172a" />
        <path className="ev-bolt" d="M300,99 L297.5,102 H299.5 L298,104.5 L301,101.2 H299 Z" fill="#4ade80" />
        <circle cx="297" cy="109" r="1.8" fill="#0f172a" />

        {/* The car drives in from the left and parks by the charger */}
        <g className="ev-car">
          <path d="M222,136 L222,124 Q224,118 232,117 L240,110 Q244,107 250,107 L264,107 Q270,107 274,112 L279,117 Q284,118 284,124 L284,136 Z" fill="#0ea5e9" stroke="#0c4a6e" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M242,116 L246,111 L256,111 L256,116 Z M259,116 L259,111 L268,111 L272,116 Z" fill="#bae6fd" />
          <circle cx="234" cy="136" r="6" fill="#0f172a" />
          <circle cx="234" cy="136" r="2.2" fill="#94a3b8" />
          <circle cx="272" cy="136" r="6" fill="#0f172a" />
          <circle cx="272" cy="136" r="2.2" fill="#94a3b8" />
          <rect x="280" y="122" width="3" height="2.5" rx="1" fill="#fde68a" />
          <rect x="269" y="119" width="4" height="4" rx="1" fill="#0c4a6e" />
        </g>
        {/* The cable goes in, then power pulses along it */}
        <path className="ev-cable" d={CABLE} pathLength="1" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
        <path className="ev-flow" d={CABLE} fill="none" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 6" />
      </svg>

      <div className="flex items-end justify-between gap-[2vmin]">
        <div className="flex flex-col gap-[0.4vmin]">
          <p className={`text-[clamp(11px,1.6vmin,30px)] font-semibold tracking-[0.12em] uppercase ${skin.accent}`}>Every minute, right now</p>
          <p className={`text-[clamp(12px,1.8vmin,34px)] ${skin.muted}`}>the turbine makes enough to drive an electric car</p>
        </div>
        <p className={`font-display text-[clamp(30px,6vmin,120px)] leading-none font-semibold whitespace-nowrap tabular-nums ${skin.text}`}>
          {formatInt(milesPerMinute)}
          <span className="ml-[0.8vmin] text-[0.4em] font-medium">miles</span>
        </p>
      </div>

      {/* The money, rolling back into the estate */}
      <div className="home-money relative h-[8vmin] overflow-hidden rounded-[1.6vmin] bg-white/10" style={{ animationDelay: "5.5s" }}>
        <svg viewBox="0 0 400 70" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
          <path d="M10,60 L60,60 M60,60 L60,10 M56,12 L64,12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${280 + i * 22} 30)`}>
              <path d="M-9,30 L-9,8 L0,0 L9,8 L9,30 Z" fill="#c9714b" stroke="#5b3a2e" strokeWidth="2" />
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} className="home-coin" cx="70" cy="50" r="7" fill="#facc15" stroke="#a16207" strokeWidth="2" style={{ animationDelay: `${5.9 + i * 0.45}s` }} />
          ))}
        </svg>
      </div>
      <p className={`home-money text-[clamp(12px,1.75vmin,32px)] leading-snug ${skin.text}`} style={{ animationDelay: "5.5s" }}>
        …and the money it earns goes back into Lawrence Weston.
      </p>
    </aside>
  );
}
