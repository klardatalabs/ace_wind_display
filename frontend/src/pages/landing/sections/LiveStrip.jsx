// "Right now" strip of live, smoothly-tweening figures.

import { useLive } from "../../../store/useLiveStore.js";
import { useTweenedNumber } from "../../../hooks/useTweenedNumber.js";
import Icon from "../../../components/ui/Icon.jsx";
import Reveal from "../../../components/ui/Reveal.jsx";
import { homesPoweredNow, co2AvoidedKg, cupsOfTea } from "../../../lib/impact.js";
import { formatInt } from "../../../lib/format.js";

function Stat({ icon, value, decimals = 0, unit, label }) {
  const v = useTweenedNumber(value, { decimals });
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-2 py-3 text-center">
      <Icon name={icon} className="size-6 text-moss-500" />
      <div className="font-display text-3xl font-bold tracking-tight text-moss-950 tabular-nums md:text-4xl">
        {decimals ? v.toFixed(decimals) : formatInt(v)}
        <span className="ml-1 text-base font-medium text-moss-600">{unit}</span>
      </div>
      <div className="text-sm text-moss-900/60">{label}</div>
    </div>
  );
}

export default function LiveStrip() {
  const live = useLive();
  return (
    <section aria-label="Live figures" className="px-4">
      <p className="mb-3 text-center text-sm text-moss-900/55">Right now on the hill above Lawrence Weston</p>
      <Reveal className="mx-auto grid max-w-[1400px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" stagger={0.06}>
        <Stat icon="bolt" value={live.powerKw} unit="kW" label="power output" />
        <Stat icon="home" value={homesPoweredNow(live.powerKw)} label="homes powered" />
        <Stat icon="wind" value={live.windSpeed} decimals={1} unit="m/s" label="wind speed" />
        <Stat icon="fan" value={live.rotorRpm} decimals={1} unit="rpm" label="rotor speed" />
        <Stat icon="leaf" value={co2AvoidedKg(live.todayKwh)} unit="kg" label={`CO₂ avoided today${live.todayStale ? ' · last known' : ''}`} />
        <Stat icon="lightbulb" value={cupsOfTea(live.todayKwh)} label={`cups of tea, today${live.todayStale ? ' · last known' : ''}`} />
      </Reveal>
    </section>
  );
}
