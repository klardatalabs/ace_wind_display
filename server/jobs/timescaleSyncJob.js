import { getWecStdRangeAll as getWecStdRange } from "../clients/aceClient.js";
import { normaliseTimestamp } from '../history/telemetry.js';
import { isDbAvailable, getLatestStoredTimestamp, upsertLive10mBatch, refreshDailyRollup } from "../db/timescaleDb.js";

const SYNC_FIELDS = [
  "wind_speed_mean",
  "wind_speed_max",
  "wind_speed_min",
  "active_power_mean",
  "active_power_max",
  "active_power_min",
  "rotor_speed_mean",
  "rotor_speed_max",
  "nacelle_position",
  "energy_produced",
  "operating_hours",
];

let running = false;
export async function runTimescaleSync() {
  if (running) return {skipped:true};
  running = true;
  try {
  const dbOk = await isDbAvailable();
  if (!dbOk) {
    console.warn("[Timescale Sync] TimescaleDB is not reachable. Skipping sync (app continues with live memory stream).");
    return { ok: false, error: "Database unreachable" };
  }

  try {
    const latestTs = await getLatestStoredTimestamp();
    const now = new Date();
    // Default fallback if table is empty: start from July 21, 2026
    const start = latestTs ? new Date(Date.parse(latestTs)-86400000).toISOString() : "2026-07-21T10:40:00Z";
    const startMs = new Date(start).getTime();
    const nowMs = now.getTime();
    const gapMinutes = Math.floor((nowMs - startMs) / (60 * 1000));
    const expectedGaps = Math.max(0, Math.floor(gapMinutes / 10));

    if (nowMs - startMs < 10 * 60 * 1000) {
      console.log(`[Timescale Sync] scada_10m is already up to date (latest: ${start}).`);
      return { ok: true, rowsFetched: 0, rowsInserted: 0, gapsFilled: 0 };
    }

    console.log(`[Timescale Sync] Fetching wecstd/range from ${start} to ${now.toISOString()} (${expectedGaps} potential 10m gaps)...`);
    
    // Uses aceClient with exponential backoff & 429 Retry-After handling
    const data = await getWecStdRange(SYNC_FIELDS, {
      resolution: "10m",
      start,
      end: now.toISOString(),
      pageSize: 5000,
    });

    const timestamps = data.timestamps || [];
    if (!timestamps.length) {
      console.log("[Timescale Sync] Live API returned 0 rows for requested window.");
      return { ok: true, rowsFetched: 0, rowsInserted: 0, gapsFilled: 0 };
    }

    const series = data.series || {};
    const records = [];

    for (let i = 0; i < timestamps.length; i++) {
      const rawTs = timestamps[i];
      // Live API returns microsecond timestamps (16 digits)
      const dateObj = new Date(normaliseTimestamp(rawTs,true));

      records.push({
        ts: dateObj.toISOString(),
        wind_speed_mean: series.wind_speed_mean?.[i] ?? null,
        wind_speed_max: series.wind_speed_max?.[i] ?? null,
        wind_speed_min: series.wind_speed_min?.[i] ?? null,
        active_power_mean: series.active_power_mean?.[i] ?? null,
        active_power_max: series.active_power_max?.[i] ?? null,
        active_power_min: series.active_power_min?.[i] ?? null,
        rotor_speed_mean: series.rotor_speed_mean?.[i] ?? null,
        rotor_speed_max: series.rotor_speed_max?.[i] ?? null,
        nacelle_position_mean: series.nacelle_position?.[i] ?? null,
        energy_produced: series.energy_produced?.[i] ?? null,
        operating_hours: series.operating_hours?.[i] ?? null,
      });
    }

    const rowsInserted = await upsertLive10mBatch(records);
    const gapsFilled = rowsInserted;

    // Refresh continuous aggregate for the synced window
    if (rowsInserted > 0) {
      await refreshDailyRollup(start, now.toISOString());
    }

    console.log(`[Timescale Sync] Sync completed: rows fetched: ${records.length}, rows inserted: ${rowsInserted}, gaps filled: ${gapsFilled} (range: ${start} to ${now.toISOString()})`);
    return { ok: true, rowsFetched: records.length, rowsInserted, gapsFilled };
  } catch (err) {
    console.warn(`[Timescale Sync] Error during sync: ${err.message}. Will retry on next schedule.`);
    return { ok: false, error: err.message };
  }
  } finally { running = false; }
}

export function startTimescaleSyncJob(intervalMs = 12 * 60 * 1000) {
  // Run on startup
  runTimescaleSync();

  // Recurring every intervalMs
  const timer = setInterval(runTimescaleSync, intervalMs);
  return () => clearInterval(timer);
}
