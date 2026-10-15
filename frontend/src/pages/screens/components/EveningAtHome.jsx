// The community screen's ending to the energy journey, beside the 3D street scene
// (three/evScene.js) where a neighbour plugs an electric car into a street charger. Once
// it's plugged in, this card shows how many miles an electric car could drive on each
// minute of the turbine's output right now (lib/impact.js, 0.3 kWh a mile), then coins roll
// from the turbine into the estate, because the money it earns goes back into Lawrence
// Weston (ACE's own words).

import { formatInt } from "../../../lib/format.js";
import { evMiles } from "../../../lib/impact.js";

// Seconds into the ending: the car is plugged in at about 8.6 s (evScene.js).
const SHOW_AT = 8.8;

export default function EveningAtHome({ data, skin }) {
  const milesPerMinute = evMiles(data.powerKw / 60);
  return (
    <aside className={`home-money pointer-events-none absolute top-[16vmin] right-[3vmin] z-10 flex w-[min(25vw,480px)] flex-col gap-[1.4vmin] rounded-[2.6vmin] p-[2.2vmin] ${skin.card}`} style={{ animationDelay: `${SHOW_AT}s` }}>
      <div className="flex flex-col gap-[0.4vmin]">
        <p className={`text-[clamp(11px,1.6vmin,30px)] font-semibold tracking-[0.12em] uppercase ${skin.accent}`}>Every minute, right now</p>
        <p className={`font-display text-[clamp(30px,6vmin,120px)] leading-none font-semibold tabular-nums ${skin.text}`}>
          {formatInt(milesPerMinute)}
          <span className="ml-[0.8vmin] text-[0.4em] font-medium">miles</span>
        </p>
        <p className={`text-[clamp(12px,1.8vmin,34px)] ${skin.muted}`}>the turbine makes enough to drive an electric car</p>
      </div>

      {/* The money, rolling back into the estate */}
      <div className="home-money relative h-[8vmin] overflow-hidden rounded-[1.6vmin] bg-moss-900/8" style={{ animationDelay: `${SHOW_AT + 1}s` }}>
        <svg viewBox="0 0 400 70" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
          <path d="M10,60 L60,60 M60,60 L60,10 M56,12 L64,12" stroke={skin.dark ? "#fff" : "#13553a"} strokeWidth="3" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${280 + i * 22} 30)`}>
              <path d="M-9,30 L-9,8 L0,0 L9,8 L9,30 Z" fill="#c9714b" stroke="#5b3a2e" strokeWidth="2" />
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} className="home-coin" cx="70" cy="50" r="7" fill="#facc15" stroke="#a16207" strokeWidth="2" style={{ animationDelay: `${SHOW_AT + 1.4 + i * 0.45}s` }} />
          ))}
        </svg>
      </div>
      <p className={`home-money text-[clamp(12px,1.75vmin,32px)] leading-snug ${skin.text}`} style={{ animationDelay: `${SHOW_AT + 1}s` }}>
        …and the money it earns goes back into Lawrence Weston.
      </p>
    </aside>
  );
}
