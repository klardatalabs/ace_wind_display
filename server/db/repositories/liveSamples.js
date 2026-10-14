// Live 1-second samples: batched writes from the collector, and reads for "today so far"
// and for rebuilding live state when Redis is unavailable.

import { query } from "../../infra/postgres.js";
import { londonDayStart } from "../../../shared/time.js";

export async function insertSiteSamples(rows) {
  if (!rows.length) return 0;
  const { rowCount } = await query(
    `INSERT INTO ts.site_sample (site_id, observed_at, active_power_kw, wind_speed_ms, wind_direction_deg, available_power_kw, theoretical_max_power_kw)
     SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(site_id text, observed_at timestamptz, active_power_kw float8,
       wind_speed_ms float8, wind_direction_deg float8, available_power_kw float8, theoretical_max_power_kw float8)
     ON CONFLICT DO NOTHING`,
    [JSON.stringify(rows)]
  );
  return rowCount;
}

export async function insertAssetSamples(rows) {
  if (!rows.length) return 0;
  const { rowCount } = await query(
    `INSERT INTO ts.asset_sample (asset_id, observed_at, active_power_kw, wind_speed_ms, rotor_speed_rpm, nacelle_position_deg, energy_exported_kwh, operating_hours)
     SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(asset_id text, observed_at timestamptz, active_power_kw float8,
       wind_speed_ms float8, rotor_speed_rpm float8, nacelle_position_deg float8, energy_exported_kwh float8, operating_hours float8)
     ON CONFLICT DO NOTHING`,
    [JSON.stringify(rows)]
  );
  return rowCount;
}

/** The newest stored site and turbine readings (null when nothing is stored yet). */
export async function latestSamples(siteId, assetId) {
  const { rows } = await query(
    `SELECT (SELECT to_jsonb(s) FROM ts.site_sample s WHERE site_id = $1 ORDER BY observed_at DESC LIMIT 1) AS site,
            (SELECT to_jsonb(a) FROM ts.asset_sample a WHERE asset_id = $2 ORDER BY observed_at DESC LIMIT 1) AS asset`,
    [siteId, assetId]
  );
  return rows[0];
}

/** Per-minute figures since UK midnight, for today's energy. */
export async function todayFromMinutes(assetId, now = new Date()) {
  const dayStart = londonDayStart(now);
  const { rows } = await query(
    `SELECT first(energy_exported_first_kwh, bucket) AS meter_start_kwh,
            last(energy_exported_last_kwh, bucket)   AS meter_now_kwh,
            sum(active_power_avg_kw) / 60.0          AS energy_from_power_kwh,
            count(*)                                 AS minutes,
            min(bucket)                              AS first_minute,
            max(bucket)                              AS last_minute
     FROM ts.asset_minute WHERE asset_id = $1 AND bucket >= $2`,
    [assetId, dayStart]
  );
  return { ...rows[0], dayStart };
}
