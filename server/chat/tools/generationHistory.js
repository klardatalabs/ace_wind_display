import { pool, isDbAvailable, getTimescaleRecords, getTimescaleComparisonMetrics } from "../../db/timescaleDb.js";
import { getDailyRollups } from "../../db/sqliteDb.js";

export const definition = {
  type: "function",
  function: {
    name: "get_generation_history",
    description:
      "Historical generation from the turbine database. period='last_24_hours' for yesterday/recent, 'records' for all-time bests and totals, 'monthly_comparison' to compare months, 'date' for one specific day (give date as YYYY-MM-DD).",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["last_24_hours", "records", "monthly_comparison", "date"] },
        date: { type: "string", description: "YYYY-MM-DD, only when period is 'date'" },
      },
      required: ["period"],
      additionalProperties: false,
    },
  },
};

async function last24Hours() {
  const { rows } = await pool.query(`
    SELECT ROUND((SUM(active_power_mean) / 6.0)::numeric, 0) AS energy_kwh,
           ROUND(AVG(active_power_mean)::numeric, 1)         AS avg_power_kw,
           ROUND(MAX(active_power_max)::numeric, 1)          AS max_power_kw,
           ROUND(AVG(wind_speed_mean)::numeric, 1)           AS avg_wind_ms,
           ROUND(MAX(wind_speed_max)::numeric, 1)            AS max_wind_ms,
           ROUND(((SUM(active_power_mean) / 6.0) / (4200.0 * 24.0) * 100.0)::numeric, 1) AS capacity_factor_pct
    FROM scada_10m
    WHERE ts >= (SELECT MAX(ts) - INTERVAL '24 hours' FROM scada_10m);`);
  return rows[0]?.energy_kwh ? { period: "most recent 24 hours of stored data", ...rows[0] } : { message: "No recent data stored." };
}

async function singleDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return { error: "date must be YYYY-MM-DD" };
  const { rows } = await pool.query(
    `SELECT bucket AS day, energy_kwh, active_power_avg AS avg_power_kw, active_power_max AS max_power_kw,
            wind_speed_avg AS avg_wind_ms, wind_speed_max AS max_wind_ms
     FROM daily_rollup WHERE bucket::date = $1::date LIMIT 1;`,
    [date]
  );
  return rows[0] || { message: `No stored generation data for ${date}.` };
}

export async function run({ period, date } = {}) {
  try {
    if (!(await isDbAvailable())) {
      // SQLite fallback only holds daily rollups.
      const days = getDailyRollups(7);
      return days.length ? { source: "local cache", recent_days: days } : { message: "Historical database is offline right now." };
    }
    if (period === "records") return await getTimescaleRecords();
    if (period === "monthly_comparison") return await getTimescaleComparisonMetrics({ mode: "summary" });
    if (period === "date") return await singleDay(date);
    return await last24Hours();
  } catch (err) {
    return { error: `History lookup failed: ${err.message}` };
  }
}
