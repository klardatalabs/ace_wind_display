// "A day here" on the college screen: the turbine's real output over the last 24 hours,
// drawn hour by hour in step with the time-lapse clock (content/dayStory.js), so the line
// reaches each hour as the real place behind it gets there. Each hour of the day is its
// most recent occurrence: today's if it has passed, yesterday's if not.

import { useMemo } from "react";
import { DAY_LAPSE, lapseHour } from "../../../content/dayStory.js";
import { formatPower } from "../../../lib/format.js";
import { useDayHistory } from "./DayStory.jsx";

const W = 520;
const H = 220;
const PAD = { l: 46, r: 12, t: 14, b: 30 };
const MAX_KW = 4400;
const x = (h) => PAD.l + ((h - DAY_LAPSE.from) / (DAY_LAPSE.to - DAY_LAPSE.from)) * (W - PAD.l - PAD.r);
const y = (kw) => H - PAD.b - (Math.max(0, Math.min(MAX_KW, kw)) / MAX_KW) * (H - PAD.t - PAD.b);

const londonHour = (date) => {
  const [h, m] = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).split(":").map(Number);
  return h + m / 60;
};

/** The last 24 hours as [{ hour, kw }] across the lapse's hours, in clock order. */
function dayPoints(history) {
  if (!history?.timestamps?.length) return [];
  return history.timestamps
    .map((us, i) => ({ hour: londonHour(new Date(us / 1000)), kw: history.power[i] }))
    .filter((p) => Number.isFinite(p.kw) && p.hour >= DAY_LAPSE.from && p.hour <= DAY_LAPSE.to)
    .sort((a, b) => a.hour - b.hour);
}

export default function DayTracePanel({ elapsedS, skin }) {
  const history = useDayHistory();
  const points = useMemo(() => dayPoints(history), [history]);
  const hour = lapseHour(elapsedS);
  const path = useMemo(() => points.map((p, i) => `${i ? "L" : "M"}${x(p.hour).toFixed(1)},${y(p.kw).toFixed(1)}`).join(" "), [points]);
  const area = path && `${path} L${x(points.at(-1).hour).toFixed(1)},${y(0)} L${x(points[0].hour).toFixed(1)},${y(0)} Z`;
  let now = null;
  for (const p of points) if (p.hour <= hour) now = p;
  const shown = now ? formatPower(Math.max(0, now.kw)) : null;
  const reveal = x(hour) - PAD.l;
  // Chart ink: white over a dark card, dark on a light one.
  const ink = skin.dark ? "#ffffff" : "#0a151d";
  const line = skin.dark ? "var(--color-moss-200)" : "var(--color-moss-600)";

  return (
    <figure className={`rounded-[2.4vmin] p-[2vmin] ${skin.card}`}>
      <figcaption className={`mb-[1vmin] flex items-baseline justify-between gap-[2vmin] text-[clamp(12px,1.6vmin,30px)] font-medium ${skin.text}`}>
        <span>Output, last 24 hours</span>
        <span className={`font-mono tabular-nums ${skin.accent}`}>{shown ? `${shown.value} ${shown.unit}` : "–"}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={`block w-[clamp(280px,38vmin,820px)] ${skin.glass ? "drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)]" : ""}`} role="img" aria-label="The turbine's real output through the last day">
        <defs>
          <clipPath id="day-reveal">
            <rect x={PAD.l} y="0" width={Math.max(0, reveal)} height={H} />
          </clipPath>
        </defs>
        {[0, 2000, 4000].map((kw) => (
          <g key={kw}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(kw)} y2={y(kw)} stroke={ink} strokeOpacity="0.15" />
            <text x={PAD.l - 8} y={y(kw) + 4} textAnchor="end" fontSize="12" fill={ink} opacity="0.7">{kw / 1000} MW</text>
          </g>
        ))}
        {[6, 9, 12, 15, 18, 21].map((h) => (
          <text key={h} x={x(h)} y={H - 10} textAnchor="middle" fontSize="12" fill={ink} opacity="0.7">{String(h).padStart(2, "0")}:00</text>
        ))}
        {path && (
          <g clipPath="url(#day-reveal)">
            <path d={area} fill="var(--color-moss-300)" opacity="0.18" />
            <path d={path} fill="none" stroke={line} strokeWidth="2.5" strokeLinejoin="round" />
          </g>
        )}
        <line x1={x(hour)} x2={x(hour)} y1={PAD.t} y2={y(0)} stroke={ink} strokeOpacity="0.55" strokeDasharray="4 5" />
        {now && <circle cx={x(hour)} cy={y(now.kw)} r="6" fill="var(--color-moss-400)" stroke="#fff" strokeWidth="2" />}
        {!path && (
          <text x={(W + PAD.l) / 2} y={H / 2} textAnchor="middle" fontSize="14" fill={ink} opacity="0.7">Loading the last day's readings…</text>
        )}
      </svg>
      <p className={`mt-[0.8vmin] text-[clamp(10px,1.35vmin,26px)] ${skin.muted}`}>Real 10-minute readings from the turbine, each hour its most recent.</p>
    </figure>
  );
}
