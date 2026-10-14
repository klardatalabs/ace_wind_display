// What the turbine is doing right now, from this instance's copy of the live state.

import { currentState } from "../../api/liveFeed.js";
import { homesPoweredNow, co2AvoidedKg, tipSpeedMs, msToMph, beaufortLabel } from "../../../shared/impact.js";
import { CUT_IN_WIND_MS } from "../../../shared/constants.js";

export const kind = "live_status";

export const definition = {
  type: "function",
  function: {
    name: "get_live_status",
    description: "Live turbine telemetry right now: power output, wind speed, rotor speed, homes powered, and today's energy so far. Use for any question about what the turbine is doing now or today.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

export async function run() {
  const state = currentState();
  if (!state?.now) return { available: false, note: "No live reading has arrived yet. Say the live data is unavailable right now." };
  const { now, today } = state;
  const power = Math.max(0, now.activePowerKw ?? 0);
  const wind = now.windSpeed ?? 0;
  const rpm = now.rotorRpm ?? 0;
  return {
    data: state.connected ? "live" : `last known reading from ${state.liveAt}`,
    power_kw: Math.round(power),
    wind_speed_ms: Number(wind.toFixed(1)),
    wind_description: beaufortLabel(wind),
    rotor_rpm: Number(rpm.toFixed(1)),
    blade_tip_speed_mph: Math.round(msToMph(tipSpeedMs(rpm))),
    homes_powered_now: homesPoweredNow(power),
    spinning: power > 10 && wind >= CUT_IN_WIND_MS,
    nacelle_direction_deg: Math.round(now.nacelleDeg ?? 0),
    today_energy_kwh: today ? Math.round(today.energyKwh) : null,
    today_energy_method: today?.energyMethod ?? null,
    today_data_stale: Boolean(today?.stale),
    today_co2_avoided_kg: today ? Math.round(co2AvoidedKg(today.energyKwh)) : null,
  };
}
