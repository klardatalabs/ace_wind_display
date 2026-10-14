// The shapes of the live state and weather snapshots shared by the collector (which builds
// them) and every api instance (which serves them, or rebuilds them from the database).

import { config } from "../config/index.js";
import { SITE } from "../../shared/site.js";

export const STATE_KEY = "state";
export const ENVIRONMENT_KEY = "environment";

/** Frontend-facing shapes for the stored readings. */
export const toNow = (site, turbine) => ({
  activePowerKw: Math.max(0, turbine.activePowerKw),
  windSpeed: turbine.windSpeedMs,
  aggregateWindDir: site.windDirectionDeg,
  nacelleDeg: turbine.nacellePositionDeg,
  rotorRpm: turbine.rotorSpeedRpm,
  lifetimeEnergyKwh: turbine.energyExportedKwh,
  operatingHours: turbine.operatingHours,
  availablePowerAfterSetpoints: site.availablePowerKw,
  theoreticalMaxPower: site.theoreticalMaxPowerKw,
});

export const toStatusEvent = (s) => ({
  main_status: s.mainStatus,
  substatus: s.substatus,
  fault_message_flag: s.faultMessage ? 1 : 0,
  warning_message_flag: s.warningMessage ? 1 : 0,
  service_flag: s.serviceMode ? 1 : 0,
  observed_at: s.observedAt.toISOString(),
});

/** The shape the screens read (field names kept from the earlier API). */
export function toEnvironment({ observation, main, description, sunriseAt, sunsetAt, fetchedAt }) {
  const age = Date.now() - +observation.observedAt;
  return {
    weather: {
      source: "openweather",
      observedAt: observation.observedAt.toISOString(),
      fetchedAt: (fetchedAt ?? observation.observedAt).toISOString(),
      conditionId: observation.conditionId,
      condition: main,
      description,
      tempC: observation.temperatureC,
      feelsLikeC: observation.feelsLikeC,
      humidity: observation.humidityPct,
      pressureHpa: observation.pressureHpa,
      cloudCover: observation.cloudCoverPct == null ? null : observation.cloudCoverPct / 100,
      rainMmH: observation.rainMmH ?? 0,
      snowMmH: observation.snowMmH ?? 0,
      visibilityM: observation.visibilityM,
      windMs: observation.windSpeedMs,
      windDeg: observation.windDirectionDeg,
      windGustMs: observation.windGustMs,
      sunrise: sunriseAt ? sunriseAt.toISOString() : null,
      sunset: sunsetAt ? sunsetAt.toISOString() : null,
    },
    stale: age > config.weather.staleAfterMs,
    site: { lat: SITE.lat, lon: SITE.lon },
    serverTime: new Date().toISOString(),
  };
}
