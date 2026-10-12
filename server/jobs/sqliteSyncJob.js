import { getWecStdRangeAll as getWecStdRange } from "../clients/aceClient.js";
import { normaliseTimestamp } from '../history/telemetry.js';
import { getLatestStoredTimestamp, upsert10mBatch } from "../db/sqliteDb.js";

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
export async function runSyncJob() {
  if (running) return { skipped:true };
  running = true;
  try {
    const latestTs = getLatestStoredTimestamp();
    const now = new Date();
    // Default fallback if table is empty: start from July 21, 2026
    const start = latestTs ? new Date(Date.parse(latestTs)-86400000).toISOString() : "2026-07-21T10:40:00Z";
    const startMs = new Date(start).getTime();
    const nowMs = now.getTime();

    // If latest record is less than 10 minutes old, nothing to sync
    if (nowMs - startMs < 10 * 60 * 1000) {
      console.log(`[Sync Job] scada_10m is already up-to-date (latest: ${start}).`);
      return { syncedCount: 0, latest: start };
    }

    console.log(`[Sync Job] Fetching wecstd/range from ${start} to ${now.toISOString()}...`);
    const data = await getWecStdRange(SYNC_FIELDS, {
      resolution: "10m",
      start,
      end: now.toISOString(),
      pageSize: 5000,
    });

    const timestamps = data.timestamps || [];
    if (!timestamps.length) {
      console.log("[Sync Job] Live API returned 0 new timestamps.");
      return { syncedCount: 0, latest: start };
    }

    const series = data.series || {};
    const records = [];

    for (let i = 0; i < timestamps.length; i++) {
      const rawTs = timestamps[i];
      // Live API returns timestamps in microseconds (16 digits)
      const tsIso = normaliseTimestamp(rawTs,true);

      records.push({
        timestamp: tsIso,
        wind_speed_mean: series.wind_speed_mean?.[i] ?? null,
        wind_speed_max: series.wind_speed_max?.[i] ?? null,
        wind_speed_min: series.wind_speed_min?.[i] ?? null,
        active_power_mean: series.active_power_mean?.[i] ?? null,
        active_power_max: series.active_power_max?.[i] ?? null,
        active_power_min: series.active_power_min?.[i] ?? null,
        rotor_speed_mean: series.rotor_speed_mean?.[i] ?? null,
        rotor_speed_max: series.rotor_speed_max?.[i] ?? null,
        nacelle_position: series.nacelle_position?.[i] ?? null,
        energy_produced: series.energy_produced?.[i] ?? null,
        operating_hours: series.operating_hours?.[i] ?? null,
        source: "live_sync",
      });
    }

    const inserted = upsert10mBatch(records);
    const newLatest = records[records.length - 1]?.timestamp;
    console.log(`[Sync Job] Successfully upserted ${inserted} rows into scada_10m (new latest: ${newLatest}).`);
    return { syncedCount: inserted, latest: newLatest };
  } catch (err) {
    console.warn(`[Sync Job] Warning: Sync failed (${err.message}). Will retry on next cycle.`);
    return { error: err.message };
  } finally {
    running = false;
  }
}

export function startSyncJob(intervalMs = 12 * 60 * 1000) {
  // 1. Run immediately on startup
  runSyncJob();

  // 2. Schedule recurring every intervalMs (e.g. 12 minutes)
  const timer = setInterval(runSyncJob, intervalMs);
  return () => clearInterval(timer);
}
