// The college screen's ending to the energy journey: the energy budget, live. Three bars
// grow in turn: the power in the wind passing through the rotor right now (½ρAv³, from
// the live wind speed and the 10,516 m² the rotor sweeps), the Betz limit (no rotor can
// take more than 16/27, 59.3%, of it) and what the turbine is actually delivering. Then
// the delivered power reaches the grid as a 50 Hz waveform, and the line that the readings
// are open data (the licence and citation the ACE API sends with every response).

import { formatPower } from "../../../lib/format.js";
import { CUT_IN_WIND_MS, RATED_WIND_MS } from "@shared/constants.js";

const AIR_DENSITY = 1.225; // kg/m³, standard sea-level air
const SWEPT_AREA = 10_516; // m², Enercon's figure for the 115.7 m rotor
const BETZ = 16 / 27;
// Three cycles of a sine across the trace, drawn twice so it can scroll seamlessly.
const SINE = Array.from({ length: 241 }, (_, i) => `${i ? "L" : "M"}${(i * 400) / 120},${30 - 20 * Math.sin((i / 120) * 6 * Math.PI)}`).join(" ");

const show = (kw) => {
  const p = formatPower(kw);
  return `${p.value} ${p.unit}`;
};

/** What the numbers mean this minute. */
function reading(windMs, cp) {
  if (windMs < CUT_IN_WIND_MS) return "Below cut-in: too little energy in the wind to be worth turning it into electricity.";
  // The anemometer is on the nacelle, behind the rotor, where the wind has already slowed.
  if (cp >= BETZ) return "Above Betz? The wind is measured on the nacelle, behind the rotor, where it has already slowed, so it reads low.";
  if (windMs > RATED_WIND_MS) return "Above rated wind the blades pitch to spill the excess, so the share delivered falls.";
  return "The gap to the Betz limit is lost to the blades' drag, the generator and the converter.";
}

export default function EnergyBudget({ data, skin }) {
  const windKw = (0.5 * AIR_DENSITY * SWEPT_AREA * data.windSpeed ** 3) / 1000;
  const betzKw = windKw * BETZ;
  const outKw = Math.max(0, data.powerKw);
  const cp = windKw > 1 ? outKw / windKw : 0;
  // Bar colours for a dark card or a light one.
  const bar = skin.dark ? { track: "bg-white/15 ring-white/25", wind: "bg-white/35", betz: "bg-white/70" } : { track: "bg-moss-950/8 ring-moss-950/10", wind: "bg-moss-950/25", betz: "bg-moss-950/55" };
  const rows = [
    { label: "In the wind through the rotor", kw: windKw, share: 1, note: "½ρAv³" },
    { label: "Betz limit", kw: betzKw, share: BETZ, note: "59.3%" },
    { label: "Delivered now", kw: outKw, share: Math.min(1, cp), note: windKw > 1 ? `${(cp * 100).toFixed(1)}%` : "–", live: true },
  ];
  return (
    <aside className={`milestone-in pointer-events-none absolute top-[16vmin] right-[3vmin] z-10 flex w-[min(36vw,680px)] flex-col gap-[1.6vmin] rounded-[2.4vmin] p-[2.2vmin] ${skin.card}`}>
      <p className={`font-mono text-[clamp(11px,1.5vmin,28px)] tracking-[0.12em] uppercase ${skin.accent}`}>Energy budget · {data.windSpeed.toFixed(1)} m/s now</p>

      <div className="flex flex-col gap-[1.4vmin]">
        {rows.map((r, i) => (
          <div key={r.label} className="flex flex-col gap-[0.5vmin]">
            <div className={`flex items-baseline justify-between gap-[2vmin] text-[clamp(12px,1.7vmin,32px)] ${skin.text}`}>
              <span>{r.label}</span>
              <span className="font-mono font-semibold whitespace-nowrap tabular-nums">
                {show(r.kw)} <span className={`font-normal ${skin.muted}`}>· {r.note}</span>
              </span>
            </div>
            <div className={`h-[1.6vmin] overflow-hidden rounded-full ring-1 ${bar.track}`}>
              <div
                className={`budget-bar h-full rounded-full ${r.live ? "bg-moss-400" : i === 1 ? bar.betz : bar.wind}`}
                style={{ width: `${(r.share * 100).toFixed(1)}%`, animationDelay: `${0.4 + i * 0.9}s` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className={`budget-note text-[clamp(11px,1.55vmin,30px)] leading-snug ${skin.muted}`}>{reading(data.windSpeed, cp)}</p>

      <div className="budget-grid flex flex-col gap-[0.8vmin]">
        <p className={`font-mono text-[clamp(11px,1.5vmin,28px)] tracking-[0.12em] uppercase ${skin.accent}`}>At the grid</p>
        <div className="relative h-[8vmin] overflow-hidden rounded-[1.2vmin] bg-moss-950 ring-1 ring-white/25">
          <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
            {[15, 30, 45].map((yy) => (
              <line key={yy} x1="0" x2="400" y1={yy} y2={yy} stroke="#ffffff" strokeOpacity="0.12" />
            ))}
            <g className="scope-scroll">
              <path d={SINE} fill="none" stroke="var(--color-moss-300)" strokeWidth="2.5" />
              <path d={SINE} transform="translate(400 0)" fill="none" stroke="var(--color-moss-300)" strokeWidth="2.5" />
            </g>
          </svg>
          <span className="absolute top-[0.6vmin] right-[1vmin] font-mono text-[clamp(10px,1.4vmin,26px)] text-white">50 Hz · {show(outKw)}</span>
        </div>
        <p className={`font-mono text-[clamp(10px,1.35vmin,26px)] leading-snug ${skin.muted}`}>Every reading is open data · CC BY 4.0 · doi:10.5281/zenodo.22662372</p>
      </div>
    </aside>
  );
}
