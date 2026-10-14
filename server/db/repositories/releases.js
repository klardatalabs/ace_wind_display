// Data sources and their releases (the live API's single release, Zenodo DOIs).

import { and, desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { sourceRelease } from "../schema/core.js";
import { LIVE_SOURCE, LIVE_RELEASE_REF, ZENODO_SOURCE } from "../constants.js";

let liveReleaseId = null;

/** The release every live-API row points at (seeded, so it always exists). */
export async function getLiveReleaseId() {
  if (liveReleaseId) return liveReleaseId;
  const [row] = await db
    .select({ id: sourceRelease.releaseId })
    .from(sourceRelease)
    .where(and(eq(sourceRelease.sourceId, LIVE_SOURCE), eq(sourceRelease.releaseRef, LIVE_RELEASE_REF)));
  if (!row) throw new Error("Live release missing: run the migrate step");
  liveReleaseId = row.id;
  return liveReleaseId;
}

/** The most recently imported Zenodo release, or null. */
export async function latestArchiveRelease() {
  const [row] = await db
    .select()
    .from(sourceRelease)
    .where(eq(sourceRelease.sourceId, ZENODO_SOURCE))
    .orderBy(desc(sourceRelease.importedAt))
    .limit(1);
  return row ?? null;
}

/** Records an imported archive release (idempotent); returns its id. */
export async function recordArchiveRelease(tx, releaseRef, checksum) {
  const [row] = await tx
    .insert(sourceRelease)
    .values({ sourceId: ZENODO_SOURCE, releaseRef, checksum })
    .onConflictDoUpdate({ target: [sourceRelease.sourceId, sourceRelease.releaseRef], set: { checksum } })
    .returning({ id: sourceRelease.releaseId });
  return row.id;
}
