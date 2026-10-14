// Daily figures from ts.daily_summary: recent days, one day, records, totals and month
// comparisons (always this month against last month, never hard-coded months).

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../client.js";
import { dailySummary } from "../schema/ts.js";
import { londonDate } from "../../../shared/time.js";

const d = dailySummary;

/** The last `limit` UK days, newest first, including days with no data. */
export async function recentDays(assetId, limit, today = londonDate()) {
  const from = shiftDate(today, -(limit - 1));
  const rows = await db.select().from(d).where(and(eq(d.assetId, assetId), gte(d.localDate, from))).orderBy(desc(d.dayStart));
  const byDate = new Map(rows.map((r) => [r.localDate, r]));
  return Array.from({ length: limit }, (_, i) => {
    const date = shiftDate(today, -i);
    return byDate.get(date) ?? { localDate: date, energyKwh: null, coveragePct: 0, energyMethod: null };
  });
}

export async function singleDay(assetId, localDate) {
  const [row] = await db.select().from(d).where(and(eq(d.assetId, assetId), eq(d.localDate, localDate)));
  return row ?? null;
}

/** The day with the most energy among days with near-complete data. */
export async function bestDay(assetId) {
  const [row] = await db
    .select()
    .from(d)
    .where(and(eq(d.assetId, assetId), gte(d.coveragePct, 90)))
    .orderBy(desc(d.energyKwh))
    .limit(1);
  return row ?? null;
}

export async function totals(assetId) {
  const [row] = await db
    .select({
      energyKwh: sql`sum(${d.energyKwh})`.mapWith(Number),
      days: sql`count(*)`.mapWith(Number),
      avgPowerKw: sql`avg(${d.activePowerAvgKw})`.mapWith(Number),
      avgWindMs: sql`avg(${d.windSpeedAvgMs})`.mapWith(Number),
      firstDate: sql`min(${d.localDate})`,
      lastDate: sql`max(${d.localDate})`,
    })
    .from(d)
    .where(eq(d.assetId, assetId));
  return row;
}

/** Sums over UK calendar dates [from, to). */
export async function periodTotals(assetId, from, to) {
  const [row] = await db
    .select({
      energyKwh: sql`sum(${d.energyKwh})`.mapWith(Number),
      days: sql`count(*)`.mapWith(Number),
      avgPowerKw: sql`avg(${d.activePowerAvgKw})`.mapWith(Number),
      maxPowerKw: sql`max(${d.activePowerMaxKw})`.mapWith(Number),
      avgWindMs: sql`avg(${d.windSpeedAvgMs})`.mapWith(Number),
    })
    .from(d)
    .where(and(eq(d.assetId, assetId), gte(d.localDate, from), lt(d.localDate, to)));
  return { from, to, ...row };
}

/** This calendar month so far against the whole of last month (UK dates). */
export async function monthComparison(assetId, today = londonDate()) {
  const thisMonth = `${today.slice(0, 7)}-01`;
  const lastMonth = shiftMonth(thisMonth, -1);
  const [current, previous] = await Promise.all([
    periodTotals(assetId, thisMonth, shiftDate(today, 1)),
    periodTotals(assetId, lastMonth, thisMonth),
  ]);
  return { current, previous };
}

// ---- calendar arithmetic on YYYY-MM-DD strings (no time zones involved) ----
function shiftDate(isoDate, days) {
  const t = new Date(`${isoDate}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
function shiftMonth(firstOfMonth, months) {
  const t = new Date(`${firstOfMonth}T12:00:00Z`);
  t.setUTCMonth(t.getUTCMonth() + months);
  return t.toISOString().slice(0, 10);
}
