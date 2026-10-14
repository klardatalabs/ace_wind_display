// Buffers 1-second samples and writes them in batches every few seconds. If the database is
// down, samples wait in memory (at most an hour's worth; older ones are dropped) and are
// written once it is back, so short outages lose nothing and long ones can't exhaust memory.

import { insertSiteSamples, insertAssetSamples } from "../db/repositories/liveSamples.js";
import { logger } from "../lib/logger.js";

const log = logger("collector.samples");
const MAX_BUFFERED = 3_600;

const site = [];
const turbine = [];
let dropped = 0;

function push(buffer, row) {
  buffer.push(row);
  if (buffer.length > MAX_BUFFERED) {
    buffer.shift();
    dropped++;
  }
}

export function bufferReading(reading) {
  push(site, reading.site);
  push(turbine, reading.turbine);
}

/** Writes everything buffered. Rows stay buffered if the write fails. */
export async function flushSamples() {
  if (!site.length && !turbine.length) return;
  const siteBatch = site.splice(0, site.length);
  const turbineBatch = turbine.splice(0, turbine.length);
  try {
    await insertSiteSamples(siteBatch);
    await insertAssetSamples(turbineBatch);
    if (dropped) {
      log.warn("samples were dropped while the database was unavailable", { dropped });
      dropped = 0;
    }
  } catch (err) {
    site.unshift(...siteBatch);
    turbine.unshift(...turbineBatch);
    site.splice(0, Math.max(0, site.length - MAX_BUFFERED));
    turbine.splice(0, Math.max(0, turbine.length - MAX_BUFFERED));
    throw err;
  }
}

export const bufferedCount = () => turbine.length;
