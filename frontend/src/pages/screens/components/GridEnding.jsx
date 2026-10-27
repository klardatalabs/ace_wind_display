// The college screen's ending to the energy journey: into the South West grid, live. The
// turbine's power flows into the region's grid; the mix the region is running on this
// half hour fills in fuel by fuel, wind picked out; then its forecast carbon intensity.
// The grid figures are the Carbon Intensity API's regional estimate (/api/grid).

import { useEffect, useState } from "react";
import { api } from "../../../lib/api.js";
import { formatInt, formatPower } from "../../../lib/format.js";
import TurbineMark from "../../../components/brand/TurbineMark.jsx";

// Fuel colours (hex: the app's palette is only its own greens and neutrals).
const FUELS = {
  wind: { label: "Wind", colour: "var(--color-moss-500)" },
  solar: { label: "Solar", colour: "#f2b632" },
  gas: { label: "Gas", colour: "#a8a29e" },
  nuclear: { label: "Nuclear", colour: "#a78bfa" },
  imports: { label: "Imports", colour: "#71717a" },
  biomass: { label: "Biomass", colour: "#65a30d" },
  hydro: { label: "Hydro", colour: "#14b8a6" },
  coal: { label: "Coal", colour: "#262626" },
  other: { label: "Other", colour: "#d4d4d4" },
};
const INDEX_COLOUR = { "very low": ["#1f9a58", "#fff"], low: ["#3f9f6f", "#fff"], moderate: ["#f2c94c", "#0a151d"], high: ["#f2994a", "#fff"], "very high": ["#eb5757", "#fff"] };

const londonTime = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

function useGrid() {
  const [grid, setGrid] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => api.grid().then((g) => { if (alive) { setGrid(g); setFailed(false); } }).catch(() => { if (alive) { setGrid(null); setFailed(true); } });
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return { grid, failed };
}

export default function GridEnding({ data, skin }) {
  const { grid, failed } = useGrid();
  const power = formatPower(Math.max(0, data.powerKw));
  const currentGrid = grid && Date.now() >= Date.parse(grid.from) && Date.now() < Date.parse(grid.to) ? grid : null;
  // Fuels under half a percent would be slivers; they join "other".
  const mix = currentGrid
    ? Object.values(
        currentGrid.mix.reduce((acc, m) => {
          const key = m.perc >= 0.5 ? m.fuel : "other";
          acc[key] = { fuel: key, perc: (acc[key]?.perc ?? 0) + m.perc };
          return acc;
        }, {})
      )
        .filter((m) => m.perc > 0)
        .sort((a, b) => (a.fuel === "wind" ? -1 : b.fuel === "wind" ? 1 : b.perc - a.perc))
    : [];

  return (
    <aside className={`milestone-in pointer-events-none absolute top-[16vmin] right-[3vmin] z-10 flex w-[min(38vw,720px)] flex-col gap-[1.8vmin] rounded-[2.6vmin] p-[2.4vmin] ${skin.card}`}>
      <div className="flex items-baseline justify-between gap-[2vmin]">
        <p className={`font-mono text-[clamp(11px,1.5vmin,28px)] tracking-[0.12em] uppercase ${skin.accent}`}>Into the grid</p>
        {currentGrid && <p className={`font-mono text-[clamp(10px,1.35vmin,26px)] tabular-nums ${skin.muted}`}>{londonTime(currentGrid.from)}–{londonTime(currentGrid.to)}</p>}
      </div>

      {/* The turbine's power, flowing into the region's grid */}
      <div className="flex items-center gap-[1.6vmin]">
        <span className="flex shrink-0 items-center gap-[1vmin]">
          <TurbineMark className="size-[5vmin]" />
          <span className={`font-display text-[clamp(16px,2.6vmin,52px)] leading-none font-semibold tabular-nums ${skin.text}`}>
            {data.connected ? power.value : "—"} {data.connected && <span className="text-[0.6em] font-medium">{power.unit}</span>}
          </span>
        </span>
        <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="h-[1.6vmin] min-w-0 flex-1" aria-hidden="true">
          <path d="M2,6 H198" stroke="currentColor" className="text-moss-900/15" strokeWidth="4" strokeLinecap="round" />
          <path className="grid-flow" d="M2,6 H198" stroke="var(--color-moss-500)" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 14" />
        </svg>
        <span className={`shrink-0 rounded-full px-[1.4vmin] py-[0.6vmin] text-[clamp(11px,1.6vmin,30px)] font-semibold ring-1 ring-moss-900/15 ${skin.text}`}>{currentGrid?.region ?? "South West England"}</span>
      </div>

      {/* The mix the region is running on, fuel by fuel */}
      <div className="flex flex-col gap-[1.2vmin]">
        <p className={`text-[clamp(12px,1.7vmin,32px)] font-medium ${skin.text}`}>Regional generation mix forecast</p>
        <div className="flex h-[3.6vmin] overflow-hidden rounded-[1vmin] bg-moss-900/10">
          {mix.map((m, i) => (
            <span
              key={m.fuel}
              className={`grid-seg h-full ${m.fuel === "wind" ? "relative z-10 ring-[0.4vmin] ring-moss-950/70 ring-inset" : ""}`}
              style={{ width: `${m.perc}%`, background: FUELS[m.fuel].colour, animationDelay: `${0.5 + i * 0.35}s` }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-[2.2vmin] gap-y-[0.8vmin]">
          {mix.map((m, i) => (
            <li key={m.fuel} className={`grid-in flex items-center gap-[0.8vmin] text-[clamp(11px,1.55vmin,30px)] ${m.fuel === "wind" ? `font-semibold ${skin.text}` : skin.muted}`} style={{ animationDelay: `${0.7 + i * 0.35}s` }}>
              <span className="block size-[1.3vmin] rounded-full" style={{ background: FUELS[m.fuel].colour }} />
              {FUELS[m.fuel].label} <span className="font-mono tabular-nums">{m.perc.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
        {!currentGrid && <p className={`text-[clamp(12px,1.6vmin,30px)] ${skin.muted}`}>{failed || grid ? "Current grid figures aren't available." : "Asking the grid…"}</p>}
      </div>

      {/* Regional forecast intensity is not a measure of avoided emissions. */}
      {currentGrid && (
        <div className="grid-in grid grid-cols-[auto_1fr] items-center gap-x-[2.4vmin] gap-y-[0.6vmin] border-t border-moss-900/10 pt-[1.6vmin]" style={{ animationDelay: `${1 + mix.length * 0.35}s` }}>
          <p className={`font-display text-[clamp(26px,5vmin,100px)] leading-none font-semibold tabular-nums ${skin.text}`}>
            {formatInt(currentGrid.intensity)}
            <span className="ml-[0.6vmin] text-[0.35em] font-medium">g CO₂/kWh</span>
          </p>
          <div className="flex flex-col gap-[0.6vmin]">
            {currentGrid.index && (
              <span className="w-fit rounded-full px-[1.2vmin] py-[0.3vmin] text-[clamp(10px,1.4vmin,26px)] font-semibold uppercase" style={{ background: INDEX_COLOUR[currentGrid.index]?.[0] ?? "#e5e7eb", color: INDEX_COLOUR[currentGrid.index]?.[1] ?? "#0a151d" }}>
                {currentGrid.index} carbon
              </span>
            )}
            <p className={`text-[clamp(12px,1.65vmin,32px)] leading-snug ${skin.text}`}>
              Regional carbon intensity forecast for this half-hour. This is not a measure of emissions avoided by the turbine.
            </p>
          </div>
        </div>
      )}

      <p className={`font-mono text-[clamp(9px,1.25vmin,24px)] leading-snug ${skin.muted}`}>
        Grid: Carbon Intensity API regional forecast, {currentGrid?.postcode ?? "BS11"} · Turbine: ACE open data, CC BY 4.0
      </p>
    </aside>
  );
}
