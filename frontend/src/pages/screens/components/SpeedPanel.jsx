// "Who's fastest?" for the students screen: Ace's blade tips, at the live rotor speed,
// racing things children know. The other speeds are fixed, well-known figures.

import { formatInt } from "../../../lib/format.js";

const RIVALS = [
  { id: "car", label: "A car on the motorway", mph: 70 },
  { id: "cheetah", label: "A cheetah, flat out", mph: 60 },
  { id: "bolt", label: "Usain Bolt", mph: 28 },
];

export default function SpeedPanel({ tipMph, skin }) {
  const resting = tipMph < 1;
  const rows = [{ id: "ace", label: resting ? "My blade tips (resting)" : "My blade tips, right now", mph: tipMph, mine: true }, ...RIVALS];
  const max = Math.max(80, tipMph) * 1.05;
  return (
    <figure className={`flex w-[min(30vw,640px)] flex-col gap-[1.4vmin] rounded-[2.4vmin] p-[2.4vmin] ${skin.card}`}>
      <p className={`text-[clamp(12px,1.8vmin,34px)] font-semibold tracking-[0.12em] uppercase ${skin.accent}`}>Who's fastest?</p>
      {rows.map((r, i) => (
        <div key={r.id} className="flex flex-col gap-[0.5vmin]">
          <div className="flex items-baseline justify-between gap-[2vmin]">
            <span className={`text-[clamp(13px,2vmin,40px)] ${r.mine ? `font-semibold ${skin.text}` : skin.muted}`}>{r.label}</span>
            <span className={`font-display text-[clamp(15px,2.6vmin,52px)] font-semibold tabular-nums ${r.mine ? skin.accent : skin.text}`}>{formatInt(r.mph)} mph</span>
          </div>
          <div className="h-[1.6vmin] overflow-hidden rounded-full bg-moss-100">
            <div
              className={`race-bar h-full rounded-full ${r.mine ? "bg-moss-400" : "bg-moss-800/45"}`}
              style={{ width: `${Math.max(0.5, (r.mph / max) * 100)}%`, animationDelay: `${0.3 + i * 0.15}s` }}
            />
          </div>
        </div>
      ))}
      <figcaption className={`text-[clamp(11px,1.5vmin,28px)] ${skin.muted}`}>My tip speed comes from how fast my rotor is turning this minute.</figcaption>
    </figure>
  );
}
