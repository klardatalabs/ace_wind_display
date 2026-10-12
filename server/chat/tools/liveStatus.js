import { getState } from "../../services/turbineState.js";
import { homesPoweredNow, co2AvoidedKg, tipSpeedMs, msToMph, beaufortLabel } from "../../../shared/impact.js";
import { CUT_IN_WIND_MS } from "../../../shared/constants.js";

export const definition = {
  type: "function",
  function: {
    name: "get_live_status",
    description:
      "Live turbine telemetry right now: power output, wind speed, rotor speed, homes powered, today's energy. Use for any question about what the turbine is doing now or today.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

export async function run() {
  const snapshot = getState();
  const now = snapshot.now || {};
  const powerKw = Math.max(0, now.activePowerKw || 0);
  const wind = now.windSpeed || 0;
  const rpm = now.rotorRpm || 0;
  const todayKwh = snapshot.today?.energyKwh || 0;
  return {
    power_kw: Math.round(powerKw),
    wind_speed_ms: Number(wind.toFixed(1)),
    wind_description: beaufortLabel(wind),
    rotor_rpm: Number(rpm.toFixed(1)),
    blade_tip_speed_mph: Math.round(msToMph(tipSpeedMs(rpm))),
    homes_powered_now: homesPoweredNow(powerKw),
    spinning: powerKw > 10 && wind >= CUT_IN_WIND_MS,
    today_energy_kwh: Math.round(todayKwh),
    today_co2_avoided_kg: Math.round(co2AvoidedKg(todayKwh)),
    nacelle_direction_deg: Math.round(now.nacelleDeg || 0),
    data_mode: snapshot.mode === "simulate" ? "demo (simulated values)" : snapshot.connected ? "live" : snapshot.liveAt ? "last known values" : "sample values",
    observed_at: snapshot.liveAt,
    today_data_stale: snapshot.mode!=='simulate' && Boolean(snapshot.today?.stale || snapshot.freshness?.today?.failures),
    updated_at: snapshot.updatedAt,
  };
}
