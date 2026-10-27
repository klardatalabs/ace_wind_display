// What the turbine is doing right now, from this instance's copy of the live state.

import { currentState } from "../../api/liveFeed.js";
import { homesPoweredNow, tipSpeedMs, msToMph, beaufortLabel } from "../../../shared/impact.js";
import { CUT_IN_WIND_MS } from "../../../shared/constants.js";

export const kind = "live_status";

export const definition = {
  type: "function",
  function: {
    name: "get_live_status",
    description: "Turbine telemetry: power output, wind speed, rotor speed, estimated home-demand equivalents, and today's energy. Use for questions about current or recent turbine readings.",
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
    data: state.connected && state.receivedAt && Date.now() - Date.parse(state.receivedAt) <= 30_000 ? "live" : `last known reading from ${state.liveAt}`,
    power_kw: Math.round(power),
    wind_speed_ms: Number(wind.toFixed(1)),
    wind_description: beaufortLabel(wind),
    rotor_rpm: Number(rpm.toFixed(1)),
    blade_tip_speed_mph: Math.round(msToMph(tipSpeedMs(rpm))),
    homes_demand_equivalent_estimate: homesPoweredNow(power),
    homes_assumption_kw_per_home: 0.35,
    spinning: power > 10 && wind >= CUT_IN_WIND_MS,
    nacelle_direction_deg: Math.round(now.nacelleDeg ?? 0),
    today_energy_kwh: today ? Math.round(today.energyKwh) : null,
    today_energy_method: today?.energyMethod ?? null,
    today_data_stale: Boolean(today?.stale),
  };
}
