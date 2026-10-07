// What every screen is showing right now (live or simulated), with derived figures.

import { useLiveStore } from "../../../store/useLiveStore.js";
import { classifyMood, MOOD_LINES } from "../../../lib/mood.js";
import { homesPoweredNow, tipSpeedMs, msToMph } from "@shared/impact.js";
import { theoreticalPowerKw } from "@shared/physics.js";
import { formatInt, compassPoint } from "../../../lib/format.js";

function Tile({ label, value, unit, sub }) {
  return (
    <div className="rounded-2xl bg-moss-25 p-3.5 ring-1 ring-moss-100">
      <p className="text-xs text-moss-900/60">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-bold text-moss-950 tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-moss-600">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-moss-700">{sub}</p>}
    </div>
  );
}

export default function Readouts() {
  const state = useLiveStore((s) => s.state);
  const now = state?.now ?? {};
  const mood = classifyMood(state);
  const tip = tipSpeedMs(now.rotorRpm ?? 0);
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      <Tile label="Power" value={formatInt(now.activePowerKw)} unit="kW" sub={`theory ${formatInt(theoreticalPowerKw(now.windSpeed ?? 0))} kW`} />
      <Tile label="Wind" value={(now.windSpeed ?? 0).toFixed(1)} unit="m/s" sub={`${formatInt(msToMph(now.windSpeed ?? 0))} mph`} />
      <Tile label="Rotor (exact, as on screen)" value={(now.rotorRpm ?? 0).toFixed(2)} unit="rpm" sub={`tips ${formatInt(msToMph(tip))} mph`} />
      <Tile label="Nacelle bearing" value={Math.round(now.nacelleDeg ?? 0)} unit="°" sub={compassPoint(now.nacelleDeg ?? 0)} />
      <Tile label="Homes powered" value={formatInt(homesPoweredNow(now.activePowerKw ?? 0))} sub={`today ${formatInt(state?.today?.energyKwh)} kWh`} />
      <Tile label="Mood" value={mood} sub={MOOD_LINES.community[mood]} />
    </div>
  );
}
