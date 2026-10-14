// "Today at the turbine": real time and weather, and a sunrise-to-sunset bar with the sun's
// position now. The background follows the real sky. Hidden until a genuine weather reading
// arrives (and while an admin demo override is active).

import ConditionsLine from "../../../components/live/ConditionsLine.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { useSiteConditions, ukTime } from "../../../hooks/useSiteConditions.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = ([r, g, b]) => `rgb(${r} ${g} ${b})`;

// Dark enough everywhere for white text.
const SKY = {
  zenithNight: hex("#0a1530"), horizonNight: hex("#1c2b4d"),
  zenithDay: hex("#1f5591"), horizonDay: hex("#3f7fbb"),
  zenithTwilight: hex("#2f4a7e"), horizonGolden: hex("#b5623a"),
  grey: hex("#4a5866"),
};

/** Sky colours for a sun elevation (degrees) and cloud cover (0..1). */
function skyGradient(elevationDeg, cloud) {
  const day = smooth(-6, 10, elevationDeg);
  const golden = smooth(-7, 0, elevationDeg) * (1 - smooth(5, 16, elevationDeg));
  const grey = cloud * 0.55 * day;
  const zenith = lerp(lerp(lerp(SKY.zenithNight, SKY.zenithDay, day), SKY.zenithTwilight, golden * 0.55), SKY.grey, grey);
  const horizon = lerp(lerp(lerp(SKY.horizonNight, SKY.horizonDay, day), SKY.horizonGolden, golden * 0.9), SKY.grey, grey);
  return `linear-gradient(100deg, ${css(zenith)}, ${css(horizon)})`;
}

function untilLabel(ms) {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export default function DaylightBar() {
  const c = useSiteConditions();
  if (!c.weather) return null;
  const pct = c.dayProgress != null ? c.dayProgress * 100 : null;

  return (
    <div className="mx-auto mb-3 max-w-[1400px] rounded-3xl px-5 py-4 text-white md:px-7" style={{ background: skyGradient(c.elevationDeg, c.look.cloud) }}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <ConditionsLine conditions={c} className="text-sm font-medium md:text-base" />
        <p className="text-xs text-white/70">Today at the turbine · Lawrence Weston</p>
      </div>
      {c.sunrise && c.sunset && (pct != null ? (
        <div className="mt-4 flex items-center gap-3 text-xs text-white/80 tabular-nums">
          <span>Sunrise {ukTime(c.sunrise)}</span>
          <div className="relative h-1.5 flex-1 rounded-full bg-white/20" role="img" aria-label={`${Math.round(pct)}% of today's daylight has passed`}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/60" style={{ width: `${pct}%` }} />
            <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd27a] ring-4 ring-white/25" style={{ left: `${pct}%` }} />
          </div>
          <span>Sunset {ukTime(c.sunset)}</span>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-white/80 tabular-nums">
          <Icon name="moon" className="size-4" />
          Sunrise in {untilLabel(c.nextSunrise - c.now)} · {ukTime(c.nextSunrise)}
        </p>
      ))}
    </div>
  );
}
