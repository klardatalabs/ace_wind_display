// 10-minute history from the ACE API into ts.scada_10m, every 10 minutes:
//   - incremental: from the newest stored live row minus a look-back (so ACE's revisions are
//     corrected) up to now;
//   - first run: everything back to the history start (HISTORY_YEARS, or HISTORY_START),
//     limited by what the API still holds, in 7-day slices;
//   - once a day: any gaps inside the window are fetched again.
// Afterwards the daily aggregate is refreshed for the touched range, and every api
// instance's cached history is invalidated.

import { config } from "../../config/index.js";
import { fetchApiStatus, scadaPages } from "../../integrations/ace/history.js";
import { normaliseTimestamp, TEN_MINUTES_MS } from "../../integrations/ace/telemetry.js";
import * as scada from "../../db/repositories/scada.js";
import { getLiveReleaseId } from "../../db/repositories/releases.js";
import { startRun } from "../../db/repositories/jobs.js";
import { bumpNamespace } from "../../infra/cache.js";
import { publish, CHANNELS } from "../../infra/pubsub.js";
import { logger } from "../../lib/logger.js";
import { ASSET } from "../../../shared/site.js";

const log = logger("collector.history");
const SLICE_MS = 7 * 86_400_000;
const REPAIR_EVERY_MS = 86_400_000;
let lastRepairAt = 0;

/** The configured start of history: HISTORY_START, or HISTORY_YEARS back, never before commissioning. */
export function historyStart(now = Date.now()) {
  if (config.ace.historyStart) return Date.parse(config.ace.historyStart);
  const yearsBack = new Date(now);
  yearsBack.setUTCFullYear(yearsBack.getUTCFullYear() - config.ace.historyYears);
  return Math.max(+yearsBack, Date.parse(`${ASSET.commissionedOn}T00:00:00Z`));
}

const floorTo10 = (ms) => Math.floor(ms / TEN_MINUTES_MS) * TEN_MINUTES_MS;

async function syncRange(fromMs, toMs, releaseId, totals) {
  for (let cursor = fromMs; cursor < toMs; cursor += SLICE_MS) {
    const sliceEnd = Math.min(toMs, cursor + SLICE_MS);
    for await (const page of scadaPages({ start: new Date(cursor).toISOString(), end: new Date(sliceEnd).toISOString() })) {
      const inRange = page.records.filter((r) => +r.observedAt >= cursor && +r.observedAt < sliceEnd);
      totals.fetched += page.fetched;
      totals.rejected += page.rejected;
      totals.written += await scada.upsertLive(inRange, releaseId);
    }
  }
}

export async function syncHistory() {
  const finish = await startRun("history-sync");
  const totals = { fetched: 0, written: 0, rejected: 0 };
  try {
    const status = await fetchApiStatus();
    const window = status.data_windows?.find((w) => w.family === "wecstd" && w.resolution === "10m");
    if (!window?.start || !window?.end) throw new Error("The ACE API did not report its 10-minute window");
    const available = { start: Date.parse(normaliseTimestamp(window.start)), end: Date.parse(normaliseTimestamp(window.end)) + TEN_MINUTES_MS };
    const start = Math.max(historyStart(), available.start);
    const end = Math.min(floorTo10(Date.now()), available.end);
    const releaseId = await getLiveReleaseId();

    const latest = await scada.latestObservedAt(ASSET.id, releaseId);
    const from = latest ? Math.max(start, +latest - config.ace.historyLookbackMs) : start;
    await syncRange(from, end, releaseId, totals);

    if (Date.now() - lastRepairAt > REPAIR_EVERY_MS) {
      for (const gap of await scada.findGaps(ASSET.id, new Date(start).toISOString(), new Date(from).toISOString())) {
        await syncRange(+gap.start, +gap.finish, releaseId, totals);
      }
      lastRepairAt = Date.now();
    }

    if (totals.written) {
      // The aggregate's policy only refreshes recent days; cover everything this run touched.
      await scada.refreshDailyAggregate(new Date(Math.min(from, start) - 86_400_000).toISOString(), new Date(end + 86_400_000).toISOString());
      await bumpNamespace("history");
      await publish(CHANNELS.historyUpdated, { at: new Date().toISOString() });
    }
    await finish({ ok: true, ...totals });
    if (totals.written) log.info("history synced", totals);
  } catch (err) {
    await finish({ ok: false, ...totals, error: err.message }).catch(() => {});
    throw err;
  }
}
