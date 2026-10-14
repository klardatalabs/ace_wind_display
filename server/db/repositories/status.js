// Turbine status events: stored when the status changes, read for the latest status.

import { desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { statusEvent } from "../schema/ts.js";

export async function insertStatusEvent(event) {
  await db.insert(statusEvent).values(event).onConflictDoNothing();
}

export async function latestStatusEvent(assetId) {
  const [row] = await db.select().from(statusEvent).where(eq(statusEvent.assetId, assetId)).orderBy(desc(statusEvent.observedAt)).limit(1);
  return row ?? null;
}
