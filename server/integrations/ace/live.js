// Live 1-second readings and the latest status event from the ACE API, validated: every
// required field must be present, fresh (under 30 s old), of good quality and in range,
// otherwise the whole reading is rejected and the previous one stays in place.

import { aceGet } from "./http.js";
import { normaliseTimestamp, validNumber, isGoodQuality } from "./telemetry.js";
import { SITE, ASSET } from "../../../shared/site.js";

const MAX_AGE_MS = 30_000;
const MAX_FUTURE_MS = 60_000;

// [field, output name, min, max, required]
const SITE_FIELDS = [
  ["aggregate_active_power", "activePowerKw", -1000, 6500, false],
  ["aggregate_wind_speed", "windSpeedMs", 0, 100, false],
  ["aggregate_wind_direction", "windDirectionDeg", 0, 360, true],
  ["aggregate_available_power_after_external_setpoints", "availablePowerKw", 0, 6500, true],
  ["aggregate_theoretical_maximum_active_power", "theoreticalMaxPowerKw", 0, 6500, true],
];
const TURBINE_FIELDS = [
  ["wec_active_power", "activePowerKw", -1000, 6500, true],
  ["wec_wind_speed", "windSpeedMs", 0, 100, true],
  ["wec_rotor_speed", "rotorSpeedRpm", 0, 30, true],
  ["wec_nacelle_position", "nacellePositionDeg", 0, 360, true],
  ["wec_energy_exported", "energyExportedKwh", 0, Infinity, true],
  ["wec_operating_hours", "operatingHours", 0, Infinity, false],
];

/** Pulls the newest valid value of each field out of a `latest` response. */
export function readLatest(response, fields, clock = Date.now()) {
  const out = {};
  const observed = [];
  const times = response?.timestamps;
  for (const [field, name, min, max, required] of fields) {
    const series = response?.series?.[field];
    const usable = Array.isArray(series) && Array.isArray(times) && series.length === times.length && times.length > 0;
    if (!usable) {
      if (required) throw new Error(`Missing live field ${field}`);
      out[name] = null;
      continue;
    }
    const at = Date.parse(normaliseTimestamp(times.at(-1)));
    const quality = response.quality?.at(-1);
    const fresh = clock - at <= MAX_AGE_MS && at - clock <= MAX_FUTURE_MS;
    const value = series.at(-1);
    const ok = fresh && (quality === undefined || isGoodQuality(quality)) && validNumber(value, min, max);
    if (!ok) {
      if (required) throw new Error(`Live field ${field} is stale, of bad quality or out of range`);
      out[name] = null;
      continue;
    }
    out[name] = value;
    observed.push(at);
  }
  return { values: out, observedAt: new Date(Math.min(...observed)) };
}

const fieldParam = (fields) => fields.map(([f]) => f).join(",");

/** One validated live reading for the site and the turbine. */
export async function fetchLive(clock = Date.now) {
  const [siteResponse, turbineResponse] = await Promise.all([
    aceGet(`/v1/sites/${SITE.id}/data/site_instantaneous/latest`, { resolution: "1s", limit: 1, fields: fieldParam(SITE_FIELDS) }, { retries: 0 }),
    aceGet(`/v1/sites/${SITE.id}/assets/${ASSET.id}/data/wec_instantaneous/latest`, { resolution: "1s", limit: 1, fields: fieldParam(TURBINE_FIELDS) }, { retries: 0 }),
  ]);
  const now = clock();
  const site = readLatest(siteResponse, SITE_FIELDS, now);
  const turbine = readLatest(turbineResponse, TURBINE_FIELDS, now);
  return {
    site: { siteId: SITE.id, observedAt: site.observedAt, ...site.values },
    turbine: { assetId: ASSET.id, observedAt: turbine.observedAt, ...turbine.values },
  };
}

/** Validates a status event's values (main status, substatus and the three flags). */
export function readStatus(values) {
  const flag = (v) => v === 0 || v === 1;
  if (!values || !Number.isInteger(values.main_status) || !flag(values.fault_message_flag) || !flag(values.service_flag)) {
    throw new Error("Invalid status event");
  }
  return {
    mainStatus: values.main_status,
    substatus: Number.isInteger(values.substatus) ? values.substatus : 0,
    faultMessage: values.fault_message_flag === 1,
    warningMessage: values.warning_message_flag === 1,
    serviceMode: values.service_flag === 1,
  };
}

export async function fetchStatus() {
  const data = await aceGet(`/v1/sites/${SITE.id}/assets/${ASSET.id}/events/status/latest`, { limit: 1 }, { retries: 1 });
  const event = data.events?.[0];
  if (event?.quality !== undefined && !isGoodQuality(event.quality)) throw new Error("Status event is not of good quality");
  return {
    ...readStatus(event?.values),
    observedAt: event?.observed_at ? new Date(normaliseTimestamp(event.observed_at)) : new Date(),
  };
}
