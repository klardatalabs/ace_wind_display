// 10-minute SCADA history: writes from the history sync and the archive import, and the
// reads behind charts, daily figures, records and the measured power curve.

import { and, asc, desc, eq, gte, isNotNull, lt, max, sql } from "drizzle-orm";
import { db } from "../client.js";
import { pool } from "../../infra/postgres.js";
import { scada10m, dailySummary } from "../schema/ts.js";

const VALUE_FIELDS = [
  "windSpeedMeanMs", "windSpeedMaxMs", "windSpeedMinMs",
  "activePowerMeanKw", "activePowerMaxKw", "activePowerMinKw",
  "rotorSpeedMeanRpm", "rotorSpeedMaxRpm", "nacellePositionDeg",
  "energyMeterKwh", "operatingHours",
];
const excluded = (field) => sql.raw(`excluded.${scada10m[field].name}`);

/** Live API rows: inserted, or corrected when ACE has revised them. Returns rows changed. */
export async function upsertLive(records, releaseId) {
  if (!records.length) return 0;
  const set = Object.fromEntries(VALUE_FIELDS.map((f) => [f, excluded(f)]));
  const revised = sql.join(VALUE_FIELDS.map((f) => sql`${scada10m[f]} IS DISTINCT FROM ${excluded(f)}`), sql` OR `);
  const result = await db
    .insert(scada10m)
    .values(records.map((r) => ({ ...r, releaseId })))
    .onConflictDoUpdate({
      target: [scada10m.assetId, scada10m.observedAt],
      set: { ...set, releaseId, ingestedAt: sql`now()` },
      setWhere: sql`${revised} OR ${scada10m.releaseId} IS DISTINCT FROM ${releaseId}`,
    });
  return result.rowCount;
}

/** Archive rows only fill gaps; they never overwrite what the live API reported. */
export async function insertArchive(records, releaseId) {
  if (!records.length) return 0;
  const result = await db.insert(scada10m).values(records.map((r) => ({ ...r, releaseId }))).onConflictDoNothing();
  return result.rowCount;
}

/** The newest stored 10-minute slot from a given release (null when none). */
export async function latestObservedAt(assetId, releaseId) {
  const [row] = await db
    .select({ latest: max(scada10m.observedAt) })
    .from(scada10m)
    .where(and(eq(scada10m.assetId, assetId), eq(scada10m.releaseId, releaseId)));
  return row.latest ? new Date(row.latest) : null;
}

/** Contiguous runs of missing 10-minute slots between `start` and `end`. */
export async function findGaps(assetId, start, end) {
  const { rows } = await pool.query(
    `WITH missing AS (
       SELECT t, t - (row_number() OVER (ORDER BY t)) * INTERVAL '10 minutes' AS grp
       FROM generate_series($2::timestamptz, $3::timestamptz - INTERVAL '10 minutes', INTERVAL '10 minutes') t
       WHERE NOT EXISTS (SELECT 1 FROM ts.scada_10m s WHERE s.asset_id = $1 AND s.observed_at = t)
     )
     SELECT min(t) AS start, max(t) + INTERVAL '10 minutes' AS finish FROM missing GROUP BY grp ORDER BY 1`,
    [assetId, start, end]
  );
  return rows;
}

/** Wind and power series for charts: 10-minute points up to 48 hours, daily beyond. */
export async function series(assetId, hours) {
  const since = new Date(Date.now() - hours * 3_600_000);
  if (hours > 48) {
    return db
      .select({ t: dailySummary.dayStart, wind: dailySummary.windSpeedAvgMs, power: dailySummary.activePowerAvgKw })
      .from(dailySummary)
      .where(and(eq(dailySummary.assetId, assetId), gte(dailySummary.dayStart, since)))
      .orderBy(asc(dailySummary.dayStart));
  }
  return db
    .select({ t: scada10m.observedAt, wind: scada10m.windSpeedMeanMs, power: scada10m.activePowerMeanKw })
    .from(scada10m)
    .where(and(eq(scada10m.assetId, assetId), gte(scada10m.observedAt, since)))
    .orderBy(asc(scada10m.observedAt));
}

export async function past24Hours(assetId) {
  const [row] = await db
    .select({
      energyKwh: sql`sum(${scada10m.activePowerMeanKw}) / 6.0`.mapWith(Number),
      avgPowerKw: sql`avg(${scada10m.activePowerMeanKw})`.mapWith(Number),
      maxPowerKw: max(scada10m.activePowerMaxKw),
      avgWindMs: sql`avg(${scada10m.windSpeedMeanMs})`.mapWith(Number),
      maxWindMs: max(scada10m.windSpeedMaxMs),
      samples: sql`count(${scada10m.activePowerMeanKw})`.mapWith(Number),
    })
    .from(scada10m)
    .where(and(eq(scada10m.assetId, assetId), gte(scada10m.observedAt, sql`now() - INTERVAL '24 hours'`), lt(scada10m.observedAt, sql`now()`)));
  return row;
}

/** The 10-minute slot with the highest value of `field` (activePowerMaxKw or windSpeedMaxMs). */
export async function peak(assetId, field) {
  if (!["activePowerMaxKw", "windSpeedMaxMs"].includes(field)) throw new Error(`Unsupported peak field ${field}`);
  const [row] = await db
    .select({
      observedAt: scada10m.observedAt,
      activePowerMaxKw: scada10m.activePowerMaxKw,
      activePowerMeanKw: scada10m.activePowerMeanKw,
      windSpeedMaxMs: scada10m.windSpeedMaxMs,
      windSpeedMeanMs: scada10m.windSpeedMeanMs,
    })
    .from(scada10m)
    .where(and(eq(scada10m.assetId, assetId), isNotNull(scada10m[field])))
    .orderBy(desc(scada10m[field]))
    .limit(1);
  return row ?? null;
}

/** Measured power curve: mean power per 0.5 m/s wind bin. */
export async function measuredPowerCurve(assetId) {
  const bin = sql`width_bucket(${scada10m.windSpeedMeanMs}, 0, 25, 50) * 0.5 - 0.25`;
  return db
    .select({
      binWind: bin.mapWith(Number),
      powerAvgKw: sql`avg(${scada10m.activePowerMeanKw})`.mapWith(Number),
      powerMinKw: sql`min(${scada10m.activePowerMeanKw})`.mapWith(Number),
      powerMaxKw: sql`max(${scada10m.activePowerMeanKw})`.mapWith(Number),
      powerStdKw: sql`coalesce(stddev(${scada10m.activePowerMeanKw}), 0)`.mapWith(Number),
      actualWindAvg: sql`avg(${scada10m.windSpeedMeanMs})`.mapWith(Number),
      sampleCount: sql`count(*)`.mapWith(Number),
    })
    .from(scada10m)
    .where(and(eq(scada10m.assetId, assetId), gte(scada10m.windSpeedMeanMs, 0), lt(scada10m.windSpeedMeanMs, 25), isNotNull(scada10m.activePowerMeanKw)))
    .groupBy(bin)
    .orderBy(bin);
}

/** CALL can't run inside a transaction, so this goes straight to the pool. */
export async function refreshDailyAggregate(from, to) {
  await pool.query("CALL refresh_continuous_aggregate('ts.scada_daily', $1::timestamptz, $2::timestamptz)", [from, to]);
}
