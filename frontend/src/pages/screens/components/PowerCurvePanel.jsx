// Power curve with the turbine's live operating point riding on it (College screen).
// Measured bins from /api/history/power-curve when the history DB is available.

import { useMemo } from "react";

const W = 520;
const H = 300;
const PAD = { l: 52, r: 14, t: 16, b: 38 };
const MAX_WIND = 30;
const MAX_KW = 4500;
const x = (w) => PAD.l + (Math.min(w, MAX_WIND) / MAX_WIND) * (W - PAD.l - PAD.r);
const y = (kw) => H - PAD.b - (Math.max(0, kw) / MAX_KW) * (H - PAD.t - PAD.b);

export default function PowerCurvePanel({ curve, stale=false, windSpeed, powerKw, skin, className = "" }) {
  const path = useMemo(
    () => (curve?.theoretical ?? []).filter((p) => p.wind <= MAX_WIND).map((p, i) => `${i ? "L" : "M"}${x(p.wind).toFixed(1)},${y(p.power).toFixed(1)}`).join(" "),
    [curve]
  );
  const measured = (curve?.empirical ?? []).filter((b) => b.sample_count > 3 && b.bin_wind <= MAX_WIND);
  const stroke = skin.dark ? "var(--color-moss-200)" : "var(--color-moss-700)";
  const faint = skin.dark ? "rgb(255 255 255 / 0.15)" : "rgb(10 21 29 / 0.12)";
  return (
    <figure className={`rounded-[2.4vmin] p-[2vmin] ${skin.card} ${className}`}>
      <figcaption className={`mb-[1vmin] flex items-baseline justify-between text-[clamp(12px,1.6vmin,30px)] font-medium ${skin.text}`}>
        <span>Power curve</span>
        <span className={`font-mono ${skin.accent}`}>
          {measured.length ? `${measured.reduce((s, b) => s + b.sample_count, 0).toLocaleString("en-GB")} measured intervals${stale ? ' · last known' : ''}` : "manufacturer reference"}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={`block w-[clamp(280px,38vmin,820px)] ${skin.glass ? "drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)]" : ""}`} role="img" aria-label="Power output against wind speed">
        {[0, 1000, 2000, 3000, 4000].map((kw) => (
          <g key={kw}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(kw)} y2={y(kw)} stroke={faint} />
            <text x={PAD.l - 8} y={y(kw) + 4} textAnchor="end" fontSize="12" fill={stroke} opacity="0.75">{kw / 1000} MW</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20, 25, 30].map((w) => (
          <text key={w} x={x(w)} y={H - PAD.b + 18} textAnchor="middle" fontSize="12" fill={stroke} opacity="0.75">{w}</text>
        ))}
        <text x={(W + PAD.l) / 2} y={H - 4} textAnchor="middle" fontSize="12" fill={stroke} opacity="0.6">wind speed (m/s)</text>
        {measured.map((b) => (
          <circle key={b.bin_wind} cx={x(b.bin_wind)} cy={y(b.power_avg_kw)} r="3" fill="var(--color-moss-400)" opacity="0.8" />
        ))}
        <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <line x1={x(windSpeed)} x2={x(windSpeed)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-moss-300)" strokeDasharray="4 5" />
        <circle cx={x(windSpeed)} cy={y(powerKw)} r="9" fill="var(--color-moss-300)" opacity="0.35">
          <animate attributeName="r" values="7;14;7" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={x(windSpeed)} cy={y(powerKw)} r="5.5" fill="var(--color-moss-300)" stroke="white" strokeWidth="2" />
      </svg>
    </figure>
  );
}
