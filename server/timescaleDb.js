import pg from "pg";

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

export default pool;
