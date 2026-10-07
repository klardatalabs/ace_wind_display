// Big live figure. Numeric values count smoothly toward each new reading.

import { useTweenedNumber } from "../../../hooks/useTweenedNumber.js";
import { formatInt } from "../../../lib/format.js";

function Value({ value }) {
  const raw = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  const numeric = Number.isFinite(raw) && /^[\d.,-]+$/.test(String(value));
  const decimals = numeric && String(value).includes(".") ? String(value).split(".")[1].length : 0;
  const tweened = useTweenedNumber(numeric ? raw : 0, { decimals });
  if (!numeric) return value;
  return decimals ? tweened.toFixed(decimals) : formatInt(tweened);
}

export default function StatCard({ stat, skin, className = "" }) {
  return (
    <div className={`inline-flex w-fit flex-col rounded-[2.4vmin] px-[2.6vmin] py-[2vmin] ${skin.card} ${className}`}>
      <div className={`flex items-baseline gap-[1vmin] font-display ${skin.text}`}>
        <span className="text-[clamp(40px,9vmin,200px)] leading-none font-bold tracking-tight tabular-nums">
          <Value value={stat.value} />
        </span>
        {stat.unit && <span className={`text-[clamp(18px,3.2vmin,70px)] font-medium ${skin.accent}`}>{stat.unit}</span>}
      </div>
      <p className={`mt-[0.8vmin] text-[clamp(13px,1.8vmin,36px)] ${skin.muted}`}>{stat.label}</p>
    </div>
  );
}
