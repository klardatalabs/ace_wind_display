// Imports the ACE archive on Zenodo into the database (daily check). Every yearly 10-minute
// and events file of the release the ACE API points at is downloaded (MD5-verified), read in
// batches, validated with the same rules as the live feed and used to fill gaps: archive
// rows never overwrite what the live API reported. A release counts as imported only when
// every file went in (its checksum signature is stored last), so a failed run retries.

import fs from "node:fs/promises";
import path from "node:path";
import { parquetMetadataAsync, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { config } from "../../config/index.js";
import { currentRelease, releaseFiles, downloadVerified } from "../../integrations/zenodo.js";
import { normaliseScadaPage, HISTORY_FIELDS } from "../../integrations/ace/history.js";
import { readStatus } from "../../integrations/ace/live.js";
import { db } from "../../db/client.js";
import { sourceRelease } from "../../db/schema/core.js";
import { recordArchiveRelease } from "../../db/repositories/releases.js";
import * as scada from "../../db/repositories/scada.js";
import { insertStatusEvent } from "../../db/repositories/status.js";
import { startRun } from "../../db/repositories/jobs.js";
import { bumpNamespace } from "../../infra/cache.js";
import { publish, CHANNELS } from "../../infra/pubsub.js";
import { logger } from "../../lib/logger.js";
import { ASSET } from "../../../shared/site.js";
import { ZENODO_SOURCE } from "../../db/constants.js";
import { and, eq } from "drizzle-orm";

const log = logger("collector.zenodo");
const BATCH_ROWS = 5_000;
// Positions in an archived wec_status value (same order as the live API's named values).
const STATUS_POSITIONS = { main_status: 0, substatus: 1, fault_message_flag: 2, warning_message_flag: 5, service_flag: 6 };

async function* rowsOf(file, columns) {
  const bytes = await fs.readFile(file);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const total = Number((await parquetMetadataAsync(buffer)).num_rows);
  for (let start = 0; start < total; start += BATCH_ROWS) {
    yield await parquetReadObjects({ file: buffer, compressors, columns, rowStart: start, rowEnd: Math.min(total, start + BATCH_ROWS) });
  }
}

const iso = (v) => (v instanceof Date ? v.toISOString() : new Date(Number(v)).toISOString());

async function importScada(file, releaseId, totals) {
  for await (const rows of rowsOf(file, ["asset", "family", "observed_at", "opc_quality", "values"])) {
    const own = rows.filter((r) => r.asset === ASSET.id && r.family === "wecstd");
    // Shape the batch like an API page so the same validation applies.
    const page = {
      timestamps: own.map((r) => iso(r.observed_at)),
      series: Object.fromEntries(HISTORY_FIELDS.map((f) => [f, own.map((r) => r.values?.[f] ?? null)])),
      quality: own.map((r) => r.opc_quality ?? "good"),
    };
    const { records, rejected } = normaliseScadaPage(page);
    totals.fetched += own.length;
    totals.rejected += rejected;
    totals.written += await scada.insertArchive(records, releaseId);
  }
}

async function importStatus(file, releaseId, totals) {
  for await (const rows of rowsOf(file, ["asset", "event_family", "observed_at", "opc_quality", "raw_value"])) {
    for (const r of rows) {
      if (r.asset !== ASSET.id || r.event_family !== "wec_status" || (r.opc_quality && r.opc_quality !== "good")) continue;
      totals.fetched++;
      const parts = String(r.raw_value ?? "").split(",").map((p) => (/^-?\d+$/.test(p.trim()) ? Number(p) : NaN));
      const values = Object.fromEntries(Object.entries(STATUS_POSITIONS).map(([k, i]) => [k, parts[i]]));
      try {
        await insertStatusEvent({ assetId: ASSET.id, observedAt: new Date(iso(r.observed_at)), releaseId, ...readStatus(values) });
        totals.written++;
      } catch {
        totals.rejected++;
      }
    }
  }
}

export async function importArchive() {
  const finish = await startRun("zenodo-import");
  const totals = { fetched: 0, written: 0, rejected: 0 };
  try {
    const { doi, recordId } = await currentRelease();
    const files = (await releaseFiles(recordId)).filter((f) => f.kind === "10m" || f.kind === "events");
    const signature = files.map((f) => f.checksum).join("|");
    const [existing] = await db.select().from(sourceRelease).where(and(eq(sourceRelease.sourceId, ZENODO_SOURCE), eq(sourceRelease.releaseRef, doi)));
    if (existing?.checksum === signature) return await finish({ ok: true, ...totals });

    const releaseId = await recordArchiveRelease(db, doi, null);
    const directory = path.join(config.dataDir, "zenodo", recordId);
    for (const file of files) {
      const local = path.join(directory, file.key);
      await downloadVerified(file, local);
      if (file.kind === "10m") await importScada(local, releaseId, totals);
      else await importStatus(local, releaseId, totals);
      await fs.rm(local, { force: true }); // the data now lives in the database
    }
    await scada.refreshDailyAggregate(null, null);
    await recordArchiveRelease(db, doi, signature);
    await bumpNamespace("history");
    await publish(CHANNELS.historyUpdated, { at: new Date().toISOString() });
    log.info("archive imported", { doi, ...totals });
    await finish({ ok: true, ...totals });
  } catch (err) {
    await finish({ ok: false, ...totals, error: err.message }).catch(() => {});
    throw err;
  }
}
