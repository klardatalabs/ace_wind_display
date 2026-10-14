// Weather at the site: observations, the condition codes they use, and daily sunrise/sunset.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { weatherObservation } from "../schema/ts.js";
import { weatherCondition, siteDaylight } from "../schema/core.js";

/** Stores one reading with its condition and the day's sunrise/sunset, atomically. */
export async function saveReading({ observation, condition, daylight }) {
  await db.transaction(async (tx) => {
    await tx
      .insert(weatherCondition)
      .values(condition)
      .onConflictDoUpdate({ target: weatherCondition.conditionId, set: { main: condition.main, description: condition.description } });
    await tx.insert(weatherObservation).values(observation).onConflictDoNothing();
    if (daylight) {
      await tx
        .insert(siteDaylight)
        .values(daylight)
        .onConflictDoUpdate({ target: [siteDaylight.siteId, siteDaylight.localDate], set: { sunriseAt: daylight.sunriseAt, sunsetAt: daylight.sunsetAt } });
    }
  });
}

/** The newest reading with its condition text and that day's daylight, or null. */
export async function latestReading(siteId) {
  const [row] = await db
    .select({
      observation: weatherObservation,
      main: weatherCondition.main,
      description: weatherCondition.description,
      sunriseAt: siteDaylight.sunriseAt,
      sunsetAt: siteDaylight.sunsetAt,
    })
    .from(weatherObservation)
    .innerJoin(weatherCondition, eq(weatherCondition.conditionId, weatherObservation.conditionId))
    .leftJoin(
      siteDaylight,
      sql`${siteDaylight.siteId} = ${weatherObservation.siteId}
          AND ${siteDaylight.localDate} = (${weatherObservation.observedAt} AT TIME ZONE 'Europe/London')::date`
    )
    .where(eq(weatherObservation.siteId, siteId))
    .orderBy(desc(weatherObservation.observedAt))
    .limit(1);
  return row ?? null;
}
