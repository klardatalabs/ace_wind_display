// Dataset requests: the requester, the dataset and UK date range they asked for, a hash of
// their download token, whether the email went out, and each download.

import { and, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "../client.js";
import { dataset, requester, datasetRequest, datasetDownload } from "../schema/app.js";

export const listDatasets = () => db.select().from(dataset).orderBy(dataset.datasetId);

export async function createRequest({ email, datasetId, fullName, organisation, purpose, dateFrom, dateTo, tokenSha256, expiresAt }) {
  return db.transaction(async (tx) => {
    const [person] = await tx
      .insert(requester)
      .values({ email })
      .onConflictDoUpdate({ target: requester.email, set: { email } })
      .returning({ id: requester.requesterId });
    const [request] = await tx
      .insert(datasetRequest)
      .values({ requesterId: person.id, datasetId, fullName, organisation, purpose, dateFrom, dateTo, tokenSha256, expiresAt })
      .returning({ id: datasetRequest.requestId });
    return request.id;
  });
}

export async function markEmailed(requestId) {
  await db.update(datasetRequest).set({ emailedAt: sql`now()` }).where(eq(datasetRequest.requestId, requestId));
}

/** How many requests this email made in the last `hours`. */
export async function recentRequestCount(email, hours) {
  const [row] = await db
    .select({ n: sql`count(*)`.mapWith(Number) })
    .from(datasetRequest)
    .innerJoin(requester, eq(requester.requesterId, datasetRequest.requesterId))
    .where(and(eq(requester.email, email), gte(datasetRequest.requestedAt, sql`now() - ${hours} * INTERVAL '1 hour'`)));
  return row.n;
}

/** The unexpired request a token belongs to (dataset and date range), or null. */
export async function findActiveRequest(tokenSha256) {
  const [row] = await db
    .select({
      requestId: datasetRequest.requestId, datasetId: datasetRequest.datasetId, label: dataset.label,
      dateFrom: datasetRequest.dateFrom, dateTo: datasetRequest.dateTo,
    })
    .from(datasetRequest)
    .innerJoin(dataset, eq(dataset.datasetId, datasetRequest.datasetId))
    .where(and(eq(datasetRequest.tokenSha256, tokenSha256), gt(datasetRequest.expiresAt, sql`now()`)));
  return row ?? null;
}

export async function recordDownload(requestId) {
  await db.insert(datasetDownload).values({ requestId }).onConflictDoNothing();
}

/** Removes requests (and their downloads) older than `days`, for data minimisation. */
export async function purgeRequestsOlderThan(days) {
  const result = await db.delete(datasetRequest).where(lt(datasetRequest.requestedAt, sql`now() - ${days} * INTERVAL '1 day'`));
  return result.rowCount;
}
