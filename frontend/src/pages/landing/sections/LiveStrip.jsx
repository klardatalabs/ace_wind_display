// "Right now" strip of real turbine figures, smoothly tweening. Shows dashes until real data arrives.

import { useLive } from "../../../store/useLiveStore.js";
import { useTweenedNumber } from "../../../hooks/useTweenedNumber.js";
import Icon from "../../../components/ui/Icon.jsx";
import Reveal from "../../../components/ui/Reveal.jsx";
import DaylightBar from "./DaylightBar.jsx";
import { homesPoweredNow, co2AvoidedKg, cupsOfTea } from "../../../lib/impact.js";
import { formatInt } from "../../../lib/format.js";

function Stat({ icon, value, decimals = 0, unit, label, ready }) {
  const v = useTweenedNumber(value, { decimals });
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-2 py-5 text-center">
      <Icon name={icon} className="size-6 text-moss-500" />
      <div className="font-display text-3xl font-bold tracking-tight text-moss-950 tabular-nums md:text-4xl">
        {ready ? (decimals ? v.toFixed(decimals) : formatInt(v)) : "—"}
        {ready && unit && <span className="ml-1 text-base font-medium text-moss-600">{unit}</span>}
      </div>
      <div className="text-sm text-moss-900/60">{label}</div>
    </div>
  );
}

export default function LiveStrip() {
  const live = useLive();
  const ready = live.real;
  const today = `${live.todayEstimated ? " · estimated" : ""}${live.todayStale ? " · last known" : ""}`;
  return (
    <section aria-label="Turbine figures" className="px-4 md:px-6">
      <DaylightBar />
      <div className="mx-auto max-w-[1400px] rounded-4xl border border-moss-100 bg-white px-4 pt-6 pb-2">
        {ready && <p className="text-center text-sm text-moss-900/55">Right now at the turbine in Lawrence Weston</p>}
        <Reveal className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" stagger={0.06}>
          <Stat ready={ready} icon="bolt" value={live.powerKw} unit="kW" label="power output" />
          <Stat ready={ready} icon="home" value={homesPoweredNow(live.powerKw)} label="homes powered" />
          <Stat ready={ready} icon="wind" value={live.windSpeed} decimals={1} unit="m/s" label="wind speed" />
          <Stat ready={ready} icon="fan" value={live.rotorRpm} decimals={1} unit="rpm" label="rotor speed" />
          <Stat ready={ready} icon="leaf" value={co2AvoidedKg(live.todayKwh)} unit="kg" label={`CO₂ avoided today${today}`} />
          <Stat ready={ready} icon="lightbulb" value={cupsOfTea(live.todayKwh)} label={`cups of tea, today${today}`} />
        </Reveal>
      </div>
    </section>
  );
}
