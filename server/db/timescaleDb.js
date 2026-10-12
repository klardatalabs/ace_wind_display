import pg from "pg";
import {canonicalHistory,historyConfig} from "../history/config.js";
import {londonDate} from '../../shared/time.js';
import { E115_REFERENCE_CURVE } from "../../shared/physics.js";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || "ace_user",
  password: process.env.PGPASSWORD || "ace_password",
  database: process.env.PGDATABASE || "ace_wind",
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.warn("[TimescaleDB] Pool background error:", err.message);
});

export async function isDbAvailable() {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1;");
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    return false;
  }
}

export async function getLatestStoredTimestamp() {
  try {
    const res = await pool.query("SELECT MAX(ts) AS latest FROM scada_10m;");
    const latest = res.rows[0]?.latest;
    return latest ? new Date(latest).toISOString() : null;
  } catch (err) {
    console.warn("[TimescaleDB] Error reading latest timestamp:", err.message);
    return null;
  }
}

export async function upsertLive10mBatch(records) {
  if (!records || !records.length) return 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    let inserted = 0;

    const query = `
      INSERT INTO scada_10m (
        ts, wind_speed_mean, wind_speed_max, wind_speed_min,
        active_power_mean, active_power_max, active_power_min,
        rotor_speed_mean, rotor_speed_max, nacelle_position_mean,
        energy_produced, operating_hours, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'live')
      ON CONFLICT (ts) DO NOTHING;
    `;

    for (const r of records) {
      const res = await client.query(query, [
        r.ts,
        r.wind_speed_mean,
        r.wind_speed_max,
        r.wind_speed_min,
        r.active_power_mean,
        r.active_power_max,
        r.active_power_min,
        r.rotor_speed_mean,
        r.rotor_speed_max,
        r.nacelle_position_mean,
        r.energy_produced,
        r.operating_hours,
      ]);
      inserted += res.rowCount || 0;
    }

    await client.query("COMMIT;");
    return inserted;
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}

export async function refreshDailyRollup(windowStart, windowEnd) {
  try {
    const client = await pool.connect();
    try {
      await client.query(
        "CALL refresh_continuous_aggregate('daily_rollup', $1::timestamptz, $2::timestamptz);",
        [windowStart, windowEnd]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[TimescaleDB] Warning refreshing daily_rollup:", err.message);
  }
}

/**
 * Returns all-time historical generation records and peaks from TimescaleDB
 */
export async function getTimescaleRecords() {
  const [maxPowerRes, maxWindRes, maxDayRes, totalRes] = await Promise.all([
    analyticsQuery(`
      SELECT ts, active_power_mean, active_power_max, wind_speed_mean
      FROM scada_10m
      ORDER BY active_power_max DESC NULLS LAST LIMIT 1;
    `),
    analyticsQuery(`
      SELECT ts, wind_speed_mean, wind_speed_max, active_power_mean
      FROM scada_10m
      ORDER BY wind_speed_max DESC NULLS LAST LIMIT 1;
    `),
    analyticsQuery(`
      SELECT bucket AS day, energy_kwh, active_power_max, wind_speed_avg, wind_speed_max,
             ROUND((energy_kwh / (4200.0 * 24.0) * 100.0)::numeric, 1)::double precision AS capacity_factor_pct
      FROM daily_rollup
      ORDER BY energy_kwh DESC NULLS LAST LIMIT 1;
    `),
    analyticsQuery(`
      SELECT 
        ROUND(SUM(energy_kwh)::numeric, 1)::double precision AS total_energy_kwh,
        COUNT(*) AS total_days,
        ROUND(AVG(active_power_avg)::numeric, 1)::double precision AS overall_avg_power_kw,
        ROUND(AVG(wind_speed_avg)::numeric, 2)::double precision AS overall_avg_wind_ms
      FROM daily_rollup;
    `)
  ]);

  const total = totalRes.rows[0] || {};
  const maxDay = maxDayRes.rows[0] || {};
  const maxPower = maxPowerRes.rows[0] || {};
  const maxWind = maxWindRes.rows[0] || {};

  return {
    ...(canonicalHistory ? {scope:'stored history',energy_method:'estimated from 10-minute mean net power'} : {}),
    peak_power: {
      power_max_kw: maxPower.active_power_max,
      power_mean_kw: maxPower.active_power_mean,
      timestamp: maxPower.ts,
      wind_speed_ms: maxPower.wind_speed_mean,
    },
    peak_wind: {
      wind_max_ms: maxWind.wind_speed_max,
      wind_mean_ms: maxWind.wind_speed_mean,
      timestamp: maxWind.ts,
      power_kw: maxWind.active_power_mean,
    },
    highest_daily_energy: {
      date: maxDay.day ? canonicalHistory ? londonDate(new Date(maxDay.day)) : new Date(maxDay.day).toISOString().slice(0, 10) : null,
      energy_kwh: maxDay.energy_kwh,
      peak_power_kw: maxDay.active_power_max,
      avg_wind_ms: maxDay.wind_speed_avg,
      capacity_factor_pct: maxDay.capacity_factor_pct,
    },
    totals: {
      total_energy_kwh: total.total_energy_kwh,
      total_days: Number(total.total_days),
      overall_avg_power_kw: total.overall_avg_power_kw,
      overall_avg_wind_ms: total.overall_avg_wind_ms,
      homes_powered_estimate: Math.round((total.total_energy_kwh || 0) / (2900 / 365 * (Number(total.total_days) || 1))),
    }
  };
}

/**
 * Returns empirical binned power curve from TimescaleDB alongside
 * the theoretical Enercon E-115 4.2MW manufacturer power curve.
 */
export async function getTimescalePowerCurve() {
  const res = await analyticsQuery(`
    SELECT 
      width_bucket(wind_speed_mean, 0.0, 25.0, 50) AS bin_idx,
      ROUND((width_bucket(wind_speed_mean, 0.0, 25.0, 50) * 0.5 - 0.25)::numeric, 2)::double precision AS bin_wind,
      ROUND(AVG(active_power_mean)::numeric, 1)::double precision AS power_avg_kw,
      ROUND(MIN(active_power_mean)::numeric, 1)::double precision AS power_min_kw,
      ROUND(MAX(active_power_mean)::numeric, 1)::double precision AS power_max_kw,
      ROUND(COALESCE(STDDEV(active_power_mean), 0)::numeric, 1)::double precision AS power_std_kw,
      ROUND(AVG(wind_speed_mean)::numeric, 2)::double precision AS actual_wind_avg,
      COUNT(*)::integer AS sample_count
    FROM scada_10m
    WHERE wind_speed_mean IS NOT NULL AND active_power_mean IS NOT NULL AND wind_speed_mean >= 0
    GROUP BY bin_idx
    ORDER BY bin_idx ASC;
  `);

  const theoretical = E115_REFERENCE_CURVE;

  return {
    metadata: {
      turbine_model: "Enercon E-115 EP3",
      rated_power_kw: 4200,
      cut_in_speed_ms: 2.5,
      rated_wind_speed_ms: 12.5,
      storm_control_from_ms: 28.0,
      cut_out_wind_speed_ms: 34.0,
      total_samples_analyzed: res.rows.reduce((sum, r) => sum + r.sample_count, 0)
    },
    empirical: res.rows,
    theoretical,
  };
}

/**
 * Returns comparative metrics across time windows or between Zenodo and Live data.
 */
export async function getTimescaleComparisonMetrics({ mode = "summary", start1, end1, start2, end2 } = {}) {
  if (mode === "custom" && start1 && end1 && start2 && end2) {
    const [p1, p2] = await Promise.all([
      analyticsQuery(`
        SELECT 
          ROUND(SUM(energy_kwh)::numeric, 1)::double precision AS energy_kwh,
          ROUND(AVG(active_power_avg)::numeric, 1)::double precision AS power_avg_kw,
          ROUND(MAX(active_power_max)::numeric, 1)::double precision AS power_max_kw,
          ROUND(AVG(wind_speed_avg)::numeric, 2)::double precision AS wind_speed_avg,
          COUNT(*) AS day_count
        FROM daily_rollup
        WHERE bucket >= $1::timestamptz AND bucket <= $2::timestamptz
      `, [start1, end1]),
      analyticsQuery(`
        SELECT 
          ROUND(SUM(energy_kwh)::numeric, 1)::double precision AS energy_kwh,
          ROUND(AVG(active_power_avg)::numeric, 1)::double precision AS power_avg_kw,
          ROUND(MAX(active_power_max)::numeric, 1)::double precision AS power_max_kw,
          ROUND(AVG(wind_speed_avg)::numeric, 2)::double precision AS wind_speed_avg,
          COUNT(*) AS day_count
        FROM daily_rollup
        WHERE bucket >= $1::timestamptz AND bucket <= $2::timestamptz
      `, [start2, end2])
    ]);

    const period1 = p1.rows[0] || {};
    const period2 = p2.rows[0] || {};
    const delta_energy_pct = period1.energy_kwh > 0 
      ? Math.round(((period2.energy_kwh - period1.energy_kwh) / period1.energy_kwh) * 1000) / 10
      : null;

    return {
      mode: "custom",
      period_1: { start: start1, end: end1, ...period1 },
      period_2: { start: start2, end: end2, ...period2 },
      delta_energy_pct
    };
  }

  if (mode === "zenodo_vs_live") {
    // Compare summary of Zenodo dataset vs Live dataset
    const res = await analyticsQuery(`
      SELECT 
        source,
        MIN(ts) AS first_ts,
        MAX(ts) AS last_ts,
        COUNT(*) AS sample_count,
        ROUND(AVG(active_power_mean)::numeric, 1)::double precision AS avg_power_kw,
        ROUND(AVG(wind_speed_mean)::numeric, 2)::double precision AS avg_wind_ms
      FROM scada_10m
      GROUP BY source;
    `);

    return {
      mode: "zenodo_vs_live",
      sources: res.rows
    };
  }

  // Default: Today vs Yesterday, August vs September comparisons
  const [augustRes, septemberRes, recentDaysRes] = await Promise.all([
    analyticsQuery(`
      SELECT 
        ROUND(SUM(energy_kwh)::numeric, 1)::double precision AS energy_kwh,
        ROUND(AVG(active_power_avg)::numeric, 1)::double precision AS avg_power_kw,
        ROUND(AVG(wind_speed_avg)::numeric, 2)::double precision AS avg_wind_ms,
        COUNT(*) AS days
      FROM daily_rollup
      WHERE bucket >= '2026-08-01 00:00:00Z' AND bucket < '2026-09-01 00:00:00Z'
    `),
    analyticsQuery(`
      SELECT 
        ROUND(SUM(energy_kwh)::numeric, 1)::double precision AS energy_kwh,
        ROUND(AVG(active_power_avg)::numeric, 1)::double precision AS avg_power_kw,
        ROUND(AVG(wind_speed_avg)::numeric, 2)::double precision AS avg_wind_ms,
        COUNT(*) AS days
      FROM daily_rollup
      WHERE bucket >= '2026-09-01 00:00:00Z' AND bucket < '2026-10-01 00:00:00Z'
    `),
    analyticsQuery(`
      SELECT bucket AS day, energy_kwh, active_power_avg, active_power_max, wind_speed_avg, wind_speed_max
      FROM daily_rollup
      ORDER BY bucket DESC
      LIMIT 7;
    `)
  ]);

  const aug = augustRes.rows[0] || {};
  const sep = septemberRes.rows[0] || {};
  const recent = recentDaysRes.rows;

  return {
    mode: "summary",
    monthly_comparison: {
      august_2026: { ...aug, label: "August 2026" },
      september_2026: { ...sep, label: "September 2026" },
      delta_energy_pct: aug.energy_kwh > 0 
        ? Math.round(((sep.energy_kwh - aug.energy_kwh) / aug.energy_kwh) * 1000) / 10 
        : null
    },
    recent_7_days: recent.map(r => ({
      date: canonicalHistory ? londonDate(new Date(r.day)) : new Date(r.day).toISOString().slice(0, 10),
      energy_kwh: r.energy_kwh,
      avg_power_kw: r.active_power_avg,
      peak_power_kw: r.active_power_max,
      avg_wind_ms: r.wind_speed_avg,
      max_wind_ms: r.wind_speed_max,
    }))
  };
}

export default pool;

// Legacy response names stay stable while all canonical analytics read one schema.
async function analyticsQuery(sql,params=[]) {
  if(!canonicalHistory)return pool.query(sql,params);
  const asset=`$${params.length+1}`;
  sql=sql.replace('4200.0 * 24.0','4245.0 * day_duration_hours')
    .replace('wind_speed_mean >= 0','wind_speed_mean >= 0 AND wind_speed_mean < 25')
    .replaceAll(/'(2026-\d{2}-01) 00:00:00Z'/g,"'$1 00:00:00 Europe/London'");
  return pool.query(`WITH scada_10m AS (
    SELECT observed_at_utc AS ts,wind_speed_mean_ms AS wind_speed_mean,wind_speed_max_ms AS wind_speed_max,
      active_power_mean_kw AS active_power_mean,active_power_max_kw AS active_power_max,source
    FROM history.scada_10m WHERE asset_id=${asset}
  ),daily_rollup AS (SELECT * FROM history.daily_rollup WHERE asset_id=${asset}) ${sql}`,[...params,historyConfig.asset]);
}

