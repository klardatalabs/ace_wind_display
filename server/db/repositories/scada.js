// 10-minute SCADA history: writes from the history sync and the archive import, and the
// reads behind charts, daily figures, records and the measured power curve.

import { query } from "../../infra/postgres.js";

const VALUE_COLUMNS = [
  "wind_speed_mean_ms", "wind_speed_max_ms", "wind_speed_min_ms",
  "active_power_mean_kw", "active_power_max_kw", "active_power_min_kw",
  "rotor_speed_mean_rpm", "rotor_speed_max_rpm", "nacelle_position_deg",
  "energy_meter_kwh", "operating_hours",
];
const RECORDSET = `jsonb_to_recordset($1::jsonb) AS x(asset_id text, observed_at timestamptz, ${VALUE_COLUMNS.map((c) => `${c} float8`).join(", ")})`;

/** Live API rows: inserted, or corrected when ACE has revised them. Returns rows changed. */
export async function upsertLive(records, releaseId) {
  if (!records.length) return 0;
  const updates = VALUE_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  const changed = VALUE_COLUMNS.map((c) => `s.${c} IS DISTINCT FROM EXCLUDED.${c}`).join(" OR ");
  const { rowCount } = await query(
    `INSERT INTO ts.scada_10m AS s (asset_id, observed_at, release_id, ${VALUE_COLUMNS.join(", ")})
     SELECT asset_id, observed_at, $2, ${VALUE_COLUMNS.join(", ")} FROM ${RECORDSET}
     ON CONFLICT (asset_id, observed_at) DO UPDATE SET ${updates}, release_id = EXCLUDED.release_id, ingested_at = now()
     WHERE ${changed} OR s.release_id IS DISTINCT FROM EXCLUDED.release_id`,
    [JSON.stringify(records), releaseId]
  );
  return rowCount;
}

/** Archive rows only fill gaps; they never overwrite what the live API reported. */
export async function insertArchive(records, releaseId) {
  if (!records.length) return 0;
  const { rowCount } = await query(
    `INSERT INTO ts.scada_10m (asset_id, observed_at, release_id, ${VALUE_COLUMNS.join(", ")})
     SELECT asset_id, observed_at, $2, ${VALUE_COLUMNS.join(", ")} FROM ${RECORDSET}
     ON CONFLICT DO NOTHING`,
    [JSON.stringify(records), releaseId]
  );
  return rowCount;
}

/** The newest stored 10-minute slot from a given release (null when none). */
export async function latestObservedAt(assetId, releaseId) {
  const { rows } = await query("SELECT max(observed_at) AS latest FROM ts.scada_10m WHERE asset_id = $1 AND release_id = $2", [assetId, releaseId]);
  return rows[0].latest;
}

/** Contiguous runs of missing 10-minute slots between `start` and `end`. */
export async function findGaps(assetId, start, end) {
  const { rows } = await query(
    `WITH missing AS (
       SELECT t, t - (row_number() OVER (ORDER BY t)) * INTERVAL '10 minutes' AS grp
       FROM generate_series($2::timestamptz, $3::timestamptz - INTERVAL '10 minutes', INTERVAL '10 minutes') t
       WHERE NOT EXISTS (SELECT 1 FROM ts.scada_10m s WHERE s.asset_id = $1 AND s.observed_at = t)
     )
     SELECT min(t) AS start, max(t) + INTERVAL '10 minutes' AS finish FROM missing GROUP BY grp ORDER BY 1`,
    [assetId, start, end]
  );
  return rows;
}

/** Wind and power series for charts: 10-minute points up to 48 hours, daily beyond. */
export async function series(assetId, hours) {
  const sql = hours > 48
    ? `SELECT day_start AS t, wind_speed_avg_ms AS wind, active_power_avg_kw AS power FROM ts.daily_summary
       WHERE asset_id = $1 AND day_start >= now() - $2 * INTERVAL '1 hour' ORDER BY day_start`
    : `SELECT observed_at AS t, wind_speed_mean_ms AS wind, active_power_mean_kw AS power FROM ts.scada_10m
       WHERE asset_id = $1 AND observed_at >= now() - $2 * INTERVAL '1 hour' ORDER BY observed_at`;
  const { rows } = await query(sql, [assetId, hours]);
  return rows;
}

export async function past24Hours(assetId) {
  const { rows } = await query(
    `SELECT sum(active_power_mean_kw) / 6.0 AS energy_kwh, avg(active_power_mean_kw) AS avg_power_kw,
            max(active_power_max_kw) AS max_power_kw, avg(wind_speed_mean_ms) AS avg_wind_ms,
            max(wind_speed_max_ms) AS max_wind_ms, count(active_power_mean_kw) AS samples
     FROM ts.scada_10m WHERE asset_id = $1 AND observed_at >= now() - INTERVAL '24 hours'`,
    [assetId]
  );
  return rows[0];
}

/** The 10-minute slot with the highest value of a measured column. */
export async function peak(assetId, column) {
  if (!["active_power_max_kw", "wind_speed_max_ms"].includes(column)) throw new Error(`Unsupported peak column ${column}`);
  const { rows } = await query(
    `SELECT observed_at, active_power_max_kw, active_power_mean_kw, wind_speed_max_ms, wind_speed_mean_ms
     FROM ts.scada_10m WHERE asset_id = $1 AND ${column} IS NOT NULL ORDER BY ${column} DESC LIMIT 1`,
    [assetId]
  );
  return rows[0] ?? null;
}

/** Measured power curve: mean power per 0.5 m/s wind bin. */
export async function measuredPowerCurve(assetId) {
  const { rows } = await query(
    `SELECT width_bucket(wind_speed_mean_ms, 0, 25, 50) * 0.5 - 0.25 AS bin_wind,
            avg(active_power_mean_kw) AS power_avg_kw, min(active_power_mean_kw) AS power_min_kw,
            max(active_power_mean_kw) AS power_max_kw, coalesce(stddev(active_power_mean_kw), 0) AS power_std_kw,
            avg(wind_speed_mean_ms) AS actual_wind_avg, count(*) AS sample_count
     FROM ts.scada_10m
     WHERE asset_id = $1 AND wind_speed_mean_ms >= 0 AND wind_speed_mean_ms < 25 AND active_power_mean_kw IS NOT NULL
     GROUP BY 1 ORDER BY 1`,
    [assetId]
  );
  return rows;
}

export async function refreshDailyAggregate(from, to) {
  await query("CALL refresh_continuous_aggregate('ts.scada_daily', $1::timestamptz, $2::timestamptz)", [from, to]);
}
