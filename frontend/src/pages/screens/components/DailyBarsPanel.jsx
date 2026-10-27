// Energy per day for the last two weeks (/api/history/daily).

import { formatInt } from "../../../lib/format.js";

export default function DailyBarsPanel({ daily, stale=false, skin, className = "" }) {
  const days = [...(daily ?? [])].slice(0, 14).reverse();
  if (!days.length) return null;
  const max = Math.max(...days.map((d) => d.energy_kwh || 0), 1);
  return (
    <figure className={`rounded-[2.4vmin] p-[2vmin] ${skin.card} ${className}`}>
      <figcaption className={`mb-[1.2vmin] text-[clamp(12px,1.6vmin,30px)] font-medium ${skin.text}`}>Energy per day · last {days.length} days{days.some(d=>d.energy_method && !d.energy_method.startsWith('energy meter')) ? ' · includes estimates' : ''}{stale ? ' · last known' : ''}</figcaption>
      <div className="flex h-[18vmin] w-[clamp(280px,38vmin,820px)] items-end gap-[0.5vmin]">
        {days.map((d) => (
          <div key={d.date_london} className="flex h-full flex-1 flex-col justify-end" title={`${d.date_london}: ${d.energy_kwh == null ? 'missing' : `${formatInt(d.energy_kwh)} kWh`}${d.coverage_pct != null ? ` · ${d.coverage_pct}% coverage` : ''}`}>
            {d.energy_kwh != null && <div className="rounded-t-[0.6vmin] bg-gradient-to-t from-moss-500 to-moss-300" style={{ height: `${Math.max(2, ((d.energy_kwh || 0) / max) * 100)}%`,opacity:d.coverage_pct!=null && d.coverage_pct<100 ? .5 : 1 }} />}
          </div>
        ))}
      </div>
      <p className={`mt-[1vmin] font-mono text-[clamp(10px,1.2vmin,22px)] ${skin.accent}`}>peak {formatInt(max)} kWh</p>
    </figure>
  );
}
