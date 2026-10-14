// Streams a dataset as CSV for a range of UK dates, straight from the time-series tables.
// Rows are read in keyset-paginated batches inside one read-only snapshot, written with
// back-pressure, and the export stops as soon as the visitor disconnects.

import { once } from "node:events";
import { pool } from "../../infra/postgres.js";
import { londonDayStart } from "../../../shared/time.js";
import { ATTRIBUTION_TEXT, LICENSE_URL } from "../../../shared/constants.js";
import { DATASETS } from "../../../shared/datasets.js";
import { SITE, ASSET } from "../../../shared/site.js";
import { badRequest } from "../../lib/errors.js";

const BATCH = 5_000;

// Per dataset: the time column used for paging, the CSV columns, and the query.
// Every query takes $1 = from (inclusive), $2 = to (exclusive), $3 = cursor (exclusive).
const EXPORTS = {
  scada_10m: {
    time: "observed_at",
    sql: `SELECT s.observed_at, r.source_id AS source, s.wind_speed_mean_ms, s.wind_speed_max_ms, s.wind_speed_min_ms,
            s.active_power_mean_kw, s.active_power_max_kw, s.active_power_min_kw, s.rotor_speed_mean_rpm, s.rotor_speed_max_rpm,
            s.nacelle_position_deg, s.energy_meter_kwh, s.operating_hours
          FROM ts.scada_10m s JOIN core.source_release r USING (release_id)
          WHERE s.asset_id = '${ASSET.id}' AND s.observed_at >= $1 AND s.observed_at < $2 AND s.observed_at > $3
          ORDER BY s.observed_at LIMIT ${BATCH}`,
  },
  daily: {
    time: "day_start",
    sql: `SELECT local_date, day_start, energy_kwh, energy_method, coverage_pct, capacity_factor_pct, wind_speed_avg_ms,
            wind_speed_max_ms, active_power_avg_kw, active_power_max_kw
          FROM ts.daily_summary
          WHERE asset_id = '${ASSET.id}' AND day_start >= $1 AND day_start < $2 AND day_start > $3
          ORDER BY day_start LIMIT ${BATCH}`,
  },
  minute: {
    time: "bucket",
    sql: `SELECT bucket AS minute, active_power_avg_kw, active_power_max_kw, wind_speed_avg_ms, wind_speed_max_ms,
            rotor_speed_avg_rpm, energy_exported_last_kwh AS energy_meter_kwh, sample_count
          FROM ts.asset_minute
          WHERE asset_id = '${ASSET.id}' AND bucket >= $1 AND bucket < $2 AND bucket > $3
          ORDER BY bucket LIMIT ${BATCH}`,
  },
  status_events: {
    time: "observed_at",
    sql: `SELECT e.observed_at, r.source_id AS source, e.main_status, e.substatus, e.fault_message, e.warning_message, e.service_mode
          FROM ts.status_event e JOIN core.source_release r USING (release_id)
          WHERE e.asset_id = '${ASSET.id}' AND e.observed_at >= $1 AND e.observed_at < $2 AND e.observed_at > $3
          ORDER BY e.observed_at LIMIT ${BATCH}`,
  },
  weather: {
    time: "observed_at",
    sql: `SELECT w.observed_at, c.main AS condition, c.description, w.temperature_c, w.humidity_pct, w.pressure_hpa,
            w.cloud_cover_pct, w.rain_mm_h, w.visibility_m, w.wind_speed_ms, w.wind_direction_deg, w.wind_gust_ms
          FROM ts.weather_observation w JOIN core.weather_condition c USING (condition_id)
          WHERE w.site_id = '${SITE.id}' AND w.observed_at >= $1 AND w.observed_at < $2 AND w.observed_at > $3
          ORDER BY w.observed_at LIMIT ${BATCH}`,
  },
};

export function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const nextDay = (d) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000) + 1;

/** Validates a request for `datasetId` from `from` to `to` (inclusive UK dates). */
export function validateExport(datasetId, from, to) {
  const dataset = DATASETS.find((d) => d.id === datasetId);
  if (!dataset) throw badRequest("Unknown dataset.");
  if (!DATE.test(from ?? "") || !DATE.test(to ?? "") || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw badRequest("Dates must be YYYY-MM-DD.");
  }
  if (to < from) throw badRequest("The end date must not be before the start date.");
  if (daysBetween(from, to) > dataset.maxRangeDays) throw badRequest(`${dataset.label} can be downloaded ${dataset.maxRangeDays} days at a time.`);
  return dataset;
}

/** Streams the export to an Express response. */
export async function streamExport(res, datasetId, from, to) {
  const dataset = validateExport(datasetId, from, to);
  const spec = EXPORTS[datasetId];
  const start = londonDayStart(new Date(`${from}T12:00:00Z`));
  const end = londonDayStart(new Date(`${nextDay(to)}T12:00:00Z`));
  let closed = false;
  res.on("close", () => (closed = true));

  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    res.status(200).set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="weston-wind-${datasetId}-${from}-to-${to}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Attribution": ATTRIBUTION_TEXT,
      "X-License": LICENSE_URL,
    });
    let cursor = new Date(0);
    let header = true;
    for (;;) {
      const { rows, fields } = await client.query(spec.sql, [start, end, cursor]);
      if (header) {
        res.write(`${fields.map((f) => f.name).join(",")}\r\n`);
        header = false;
      }
      for (const row of rows) {
        if (closed) return;
        if (!res.write(`${fields.map((f) => csvCell(row[f.name])).join(",")}\r\n`)) await once(res, "drain");
      }
      if (rows.length < BATCH) break;
      cursor = rows.at(-1)[spec.time === "bucket" ? "minute" : spec.time];
    }
    await client.query("COMMIT");
    res.end();
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (res.headersSent) res.destroy(err);
    else throw err;
  } finally {
    client.release();
  }
  return dataset;
}
