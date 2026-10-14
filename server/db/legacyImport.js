// One-time copy of history kept by the previous versions of the app (history.scada_10m,
// public.scada_10m, public.status_events) into the ts schema. Runs only when those tables
// exist and hasn't run before; the old tables are left untouched for rollback.
// Values that break the new integrity rules are cleared rather than failing the import.

import { logger } from "../lib/logger.js";
import { ASSET } from "../../shared/site.js";
import { LIVE_SOURCE, ZENODO_SOURCE, LIVE_RELEASE_REF } from "./constants.js";

const log = logger("legacy-import");
const LEGACY_ZENODO_REF = "legacy-import";

// Keeps a value only when it is inside the column's allowed range.
const within = (expr, lo, hi) => `CASE WHEN ${expr} BETWEEN ${lo} AND ${hi} THEN ${expr} END`;

const IMPORTS = [
  {
    name: "history.scada_10m",
    sql: `
      INSERT INTO core.source_release (source_id, release_ref)
      SELECT DISTINCT '${ZENODO_SOURCE}', source_release FROM history.scada_10m WHERE source = 'zenodo' AND source_release IS NOT NULL
      ON CONFLICT DO NOTHING;
      INSERT INTO ts.scada_10m (asset_id, observed_at, release_id, wind_speed_mean_ms, wind_speed_max_ms,
                                active_power_mean_kw, active_power_max_kw, energy_meter_kwh)
      SELECT s.asset_id, s.observed_at_utc, r.release_id,
             ${within("s.wind_speed_mean_ms", 0, 100)},
             CASE WHEN s.wind_speed_max_ms BETWEEN 0 AND 100 AND s.wind_speed_max_ms >= s.wind_speed_mean_ms THEN s.wind_speed_max_ms END,
             ${within("s.active_power_mean_kw", -1000, 6500)},
             CASE WHEN s.active_power_max_kw BETWEEN -1000 AND 6500 AND s.active_power_max_kw >= s.active_power_mean_kw THEN s.active_power_max_kw END,
             CASE WHEN s.energy_meter_kwh >= 0 THEN s.energy_meter_kwh END
      FROM history.scada_10m s
      JOIN core.asset a ON a.asset_id = s.asset_id
      JOIN core.source_release r ON (s.source = 'live' AND r.source_id = '${LIVE_SOURCE}' AND r.release_ref = '${LIVE_RELEASE_REF}')
                                 OR (s.source = 'zenodo' AND r.source_id = '${ZENODO_SOURCE}' AND r.release_ref = s.source_release)
      WHERE EXTRACT(EPOCH FROM s.observed_at_utc)::bigint % 600 = 0
        AND num_nonnulls(s.wind_speed_mean_ms, s.active_power_mean_kw, s.energy_meter_kwh) > 0
      ON CONFLICT DO NOTHING`,
  },
  {
    name: "public.scada_10m",
    sql: `
      INSERT INTO core.source_release (source_id, release_ref) VALUES ('${ZENODO_SOURCE}', '${LEGACY_ZENODO_REF}') ON CONFLICT DO NOTHING;
      INSERT INTO ts.scada_10m (asset_id, observed_at, release_id, wind_speed_mean_ms, wind_speed_max_ms, wind_speed_min_ms,
                                active_power_mean_kw, active_power_max_kw, active_power_min_kw, rotor_speed_mean_rpm,
                                rotor_speed_max_rpm, nacelle_position_deg, energy_meter_kwh, operating_hours)
      SELECT '${ASSET.id}', s.ts, r.release_id,
             ${within("s.wind_speed_mean", 0, 100)},
             CASE WHEN s.wind_speed_max BETWEEN 0 AND 100 AND s.wind_speed_max >= s.wind_speed_mean THEN s.wind_speed_max END,
             CASE WHEN s.wind_speed_min BETWEEN 0 AND 100 AND s.wind_speed_min <= s.wind_speed_mean THEN s.wind_speed_min END,
             ${within("s.active_power_mean", -1000, 6500)},
             CASE WHEN s.active_power_max BETWEEN -1000 AND 6500 AND s.active_power_max >= s.active_power_mean THEN s.active_power_max END,
             CASE WHEN s.active_power_min BETWEEN -1000 AND 6500 AND s.active_power_min <= s.active_power_mean THEN s.active_power_min END,
             ${within("s.rotor_speed_mean", 0, 30)},
             CASE WHEN s.rotor_speed_max BETWEEN 0 AND 30 AND s.rotor_speed_max >= s.rotor_speed_mean THEN s.rotor_speed_max END,
             ${within("s.nacelle_position_mean", 0, 360)},
             CASE WHEN s.energy_produced >= 0 THEN s.energy_produced END,
             CASE WHEN s.operating_hours >= 0 THEN s.operating_hours END
      FROM public.scada_10m s
      JOIN core.source_release r ON (s.source = 'live' AND r.source_id = '${LIVE_SOURCE}' AND r.release_ref = '${LIVE_RELEASE_REF}')
                                 OR (s.source <> 'live' AND r.source_id = '${ZENODO_SOURCE}' AND r.release_ref = '${LEGACY_ZENODO_REF}')
      WHERE EXTRACT(EPOCH FROM s.ts)::bigint % 600 = 0
        AND num_nonnulls(s.wind_speed_mean, s.active_power_mean, s.energy_produced) > 0
      ON CONFLICT DO NOTHING`,
  },
  {
    name: "public.status_events",
    sql: `
      INSERT INTO core.source_release (source_id, release_ref) VALUES ('${ZENODO_SOURCE}', '${LEGACY_ZENODO_REF}') ON CONFLICT DO NOTHING;
      INSERT INTO ts.status_event (asset_id, observed_at, release_id, main_status, substatus, fault_message, warning_message, service_mode)
      SELECT '${ASSET.id}', e.observed_at, r.release_id, e.main_status, COALESCE(e.substatus, 0),
             COALESCE(e.fault_message_flag, 0) = 1, COALESCE(e.warning_message_flag, 0) = 1, COALESCE(e.service_flag, 0) = 1
      FROM public.status_events e
      JOIN core.source_release r ON r.source_id = '${ZENODO_SOURCE}' AND r.release_ref = '${LEGACY_ZENODO_REF}'
      WHERE e.main_status IS NOT NULL
      ON CONFLICT DO NOTHING`,
  },
];

/** @param {import("pg").Pool} pool */
export async function importLegacyHistory(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS meta.legacy_import (
    source_table text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now())`);
  let imported = 0;
  for (const { name, sql } of IMPORTS) {
    const { rows } = await pool.query(
      "SELECT to_regclass($1) IS NOT NULL AS present, EXISTS (SELECT 1 FROM meta.legacy_import WHERE source_table = $1) AS done",
      [name]
    );
    if (!rows[0].present || rows[0].done) continue;
    log.info("importing legacy history", { table: name });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO meta.legacy_import (source_table) VALUES ($1)", [name]);
      await client.query("COMMIT");
      imported++;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(`Legacy import from ${name} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  // The daily aggregate's policy only refreshes recent days; rebuild it over the imported range.
  if (imported) await pool.query("CALL refresh_continuous_aggregate('ts.scada_daily', NULL, NULL)");
}
