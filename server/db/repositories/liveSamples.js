// Live 1-second samples: batched writes from the collector, and reads for "today so far"
// and for rebuilding live state when Redis is unavailable.

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../client.js";
import { siteSample, assetSample, assetMinute } from "../schema/ts.js";
import { londonDayStart } from "../../../shared/time.js";

export async function insertSiteSamples(rows) {
  if (!rows.length) return 0;
  const result = await db.insert(siteSample).values(rows).onConflictDoNothing();
  return result.rowCount;
}

export async function insertAssetSamples(rows) {
  if (!rows.length) return 0;
  const result = await db.insert(assetSample).values(rows).onConflictDoNothing();
  return result.rowCount;
}

/** The newest stored site and turbine readings (each null when nothing is stored yet). */
export async function latestSamples(siteId, assetId) {
  const [site] = await db.select().from(siteSample).where(eq(siteSample.siteId, siteId)).orderBy(desc(siteSample.observedAt)).limit(1);
  const [turbine] = await db.select().from(assetSample).where(eq(assetSample.assetId, assetId)).orderBy(desc(assetSample.observedAt)).limit(1);
  return { site: site ?? null, turbine: turbine ?? null };
}

/** Per-minute figures since UK midnight, for today's energy. */
export async function todayFromMinutes(assetId, now = new Date()) {
  const dayStart = londonDayStart(now);
  const [row] = await db
    .select({
      meterStartKwh: sql`first(${assetMinute.energyExportedFirstKwh}, ${assetMinute.bucket})`.mapWith(Number),
      meterNowKwh: sql`last(${assetMinute.energyExportedLastKwh}, ${assetMinute.bucket})`.mapWith(Number),
      energyFromPowerKwh: sql`sum(${assetMinute.activePowerAvgKw}) / 60.0`.mapWith(Number),
      minutes: sql`count(*)`.mapWith(Number),
      firstMinute: sql`min(${assetMinute.bucket})`.mapWith((v) => (v ? new Date(v) : null)),
      lastMinute: sql`max(${assetMinute.bucket})`.mapWith((v) => (v ? new Date(v) : null)),
    })
    .from(assetMinute)
    .where(and(eq(assetMinute.assetId, assetId), gte(assetMinute.bucket, dayStart)));
  return { ...row, dayStart };
}
