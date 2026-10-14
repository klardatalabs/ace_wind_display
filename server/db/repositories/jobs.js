// Background job runs: one row per run, so failures and throughput are visible in the
// database instead of in log files.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { jobRun } from "../schema/app.js";

/** Starts a run and returns a function that finishes it. */
export async function startRun(jobId) {
  const [{ runId }] = await db.insert(jobRun).values({ jobId }).returning({ runId: jobRun.runId });
  return async function finish({ ok, fetched, written, rejected, error } = {}) {
    await db
      .update(jobRun)
      .set({
        finishedAt: sql`now()`,
        outcome: ok ? "succeeded" : "failed",
        rowsFetched: fetched ?? null,
        rowsWritten: written ?? null,
        rowsRejected: rejected ?? null,
        errorSummary: error ? String(error).slice(0, 500) : null,
      })
      .where(eq(jobRun.runId, runId));
  };
}

/** The latest run of each job (for the health endpoint). */
export async function latestRuns() {
  return db
    .selectDistinctOn([jobRun.jobId])
    .from(jobRun)
    .orderBy(jobRun.jobId, desc(jobRun.startedAt));
}

/** Runs left "running" by a crashed process are marked failed when the collector starts. */
export async function failAbandonedRuns() {
  await db
    .update(jobRun)
    .set({ finishedAt: sql`now()`, outcome: "failed", errorSummary: "abandoned: the process stopped mid-run" })
    .where(eq(jobRun.outcome, "running"));
}
