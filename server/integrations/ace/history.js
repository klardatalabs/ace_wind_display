// 10-minute SCADA history from the ACE API. Pages are fetched one after another (never in
// parallel, per ACE's etiquette) and checked: identity, alignment, advancing timestamps,
// no repeated cursors. Each row is validated against the same rules as ts.scada_10m.

import { aceGet } from "./http.js";
import { normaliseTimestamp, validNumber, isGoodQuality } from "./telemetry.js";
import { SITE, ASSET } from "../../../shared/site.js";

// API field -> [column (camelCase, as in the Drizzle schema), min, max]
const FIELDS = {
  wind_speed_mean: ["windSpeedMeanMs", 0, 100],
  wind_speed_max: ["windSpeedMaxMs", 0, 100],
  wind_speed_min: ["windSpeedMinMs", 0, 100],
  active_power_mean: ["activePowerMeanKw", -1000, 6500],
  active_power_max: ["activePowerMaxKw", -1000, 6500],
  active_power_min: ["activePowerMinKw", -1000, 6500],
  rotor_speed_mean: ["rotorSpeedMeanRpm", 0, 30],
  rotor_speed_max: ["rotorSpeedMaxRpm", 0, 30],
  nacelle_position: ["nacellePositionDeg", 0, 360],
  energy_produced: ["energyMeterKwh", 0, Infinity],
  operating_hours: ["operatingHours", 0, Infinity],
};
export const HISTORY_FIELDS = Object.keys(FIELDS);

/** The API's own description of the data windows it can serve. */
export const fetchApiStatus = () => aceGet("/v1/status", {}, { retries: 2 });

/** Drops extremes that contradict their mean (a max below the mean, a min above it). */
function makeConsistent(r) {
  for (const [min, mean, max] of [
    ["windSpeedMinMs", "windSpeedMeanMs", "windSpeedMaxMs"],
    ["activePowerMinKw", "activePowerMeanKw", "activePowerMaxKw"],
    [null, "rotorSpeedMeanRpm", "rotorSpeedMaxRpm"],
  ]) {
    if (r[mean] == null) continue;
    if (r[max] != null && r[max] < r[mean]) r[max] = null;
    if (min && r[min] != null && r[min] > r[mean]) r[min] = null;
  }
  return r;
}

/** Validates one range page into scada_10m rows. */
export function normaliseScadaPage(page) {
  if (!Array.isArray(page?.timestamps) || !page.series) throw new Error("Invalid history page");
  if (page.asset && page.asset !== ASSET.id) throw new Error("History page is for another asset");
  for (const field of HISTORY_FIELDS) {
    const s = page.series[field];
    if (s !== undefined && (!Array.isArray(s) || s.length !== page.timestamps.length)) throw new Error(`Misaligned series ${field}`);
  }
  if (page.quality && (!Array.isArray(page.quality) || page.quality.length !== page.timestamps.length)) throw new Error("Misaligned quality");

  const records = [];
  let rejected = 0;
  page.timestamps.forEach((raw, i) => {
    if (page.quality && !isGoodQuality(page.quality[i])) return rejected++;
    let observedAt;
    try {
      observedAt = new Date(normaliseTimestamp(raw, true));
    } catch {
      return rejected++;
    }
    const row = { assetId: ASSET.id, observedAt };
    for (const [field, [column, min, max]] of Object.entries(FIELDS)) {
      const v = page.series[field]?.[i];
      row[column] = validNumber(v, min, max) ? v : null;
    }
    makeConsistent(row);
    if (row.windSpeedMeanMs == null && row.windSpeedMaxMs == null && row.activePowerMeanKw == null && row.activePowerMaxKw == null && row.energyMeterKwh == null) {
      return rejected++;
    }
    records.push(row);
  });
  return { records, rejected };
}

/** Yields validated pages of 10-minute history between `start` and `end` (ISO strings). */
export async function* scadaPages({ start, end, pageSize = 5000 }) {
  const seen = new Set();
  let cursor;
  let previous = -Infinity;
  do {
    const page = await aceGet(`/v1/sites/${SITE.id}/assets/${ASSET.id}/data/wecstd/range`, {
      resolution: "10m", fields: HISTORY_FIELDS.join(","), start, end, page_size: pageSize, cursor,
    });
    if (page.resolution && page.resolution !== "10m") throw new Error("Unexpected history resolution");
    for (const raw of page.timestamps ?? []) {
      const at = Date.parse(normaliseTimestamp(raw));
      if (at <= previous) throw new Error("History timestamps did not advance");
      previous = at;
    }
    const next = page.page?.next_cursor;
    if (page.page?.has_more && (!next || !page.timestamps?.length)) throw new Error("Incomplete history page");
    if (next && seen.has(next)) throw new Error("Repeated history cursor");
    if (next) seen.add(next);
    yield { ...normaliseScadaPage(page), fetched: page.timestamps.length };
    cursor = next;
  } while (cursor);
}
