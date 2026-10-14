// The collector: the one process that talks to the ACE API, OpenWeather and Zenodo and
// writes to the database. Run one or more copies; only the leader works, the others wait to
// take over (see leadership.js).

import { config } from "../config/index.js";
import { connectRedis, closeRedis } from "../infra/redis.js";
import { closePostgres } from "../infra/postgres.js";
import { onShutdown } from "../lib/shutdown.js";
import { logger } from "../lib/logger.js";
import { startLeadership } from "./leadership.js";
import { every } from "./scheduler.js";
import { flushSamples } from "./sampleWriter.js";
import { publishIfChanged } from "./liveState.js";
import { pollLive, pollStatus, restoreStatus, refreshToday } from "./jobs/live.js";
import { refreshWeather, restoreWeather } from "./jobs/weather.js";
import { syncHistory } from "./jobs/history.js";
import { importArchive } from "./jobs/zenodo.js";
import { applyRetention } from "./jobs/retention.js";
import { failAbandonedRuns } from "../db/repositories/jobs.js";
import { weatherEnabled } from "../integrations/openWeather.js";

const log = logger("collector");
let stopJobs = [];

async function startJobs() {
  await failAbandonedRuns().catch((err) => log.warn("could not close abandoned job runs", { err }));
  await Promise.all([restoreStatus(), restoreWeather()]);
  stopJobs = [
    every("live", config.ace.livePollMs, pollLive, { maxBackoffMs: 30_000 }),
    every("status", config.ace.statusPollMs, pollStatus, { maxBackoffMs: 60_000 }),
    every("samples", 5_000, flushSamples, { maxBackoffMs: 60_000 }),
    every("today", 60_000, refreshToday, { initialDelayMs: 5_000 }),
    every("heartbeat", 10_000, () => publishIfChanged()),
    every("history", config.ace.historySyncMs, syncHistory, { initialDelayMs: 10_000 }),
    every("zenodo", config.ace.zenodoCheckMs, importArchive, { initialDelayMs: 60_000, maxBackoffMs: 6 * 3_600_000 }),
    every("retention", 24 * 3_600_000, applyRetention, { initialDelayMs: 120_000 }),
    ...(weatherEnabled() ? [every("weather", config.weather.refreshMs, refreshWeather, { maxBackoffMs: 30 * 60_000 })] : []),
  ];
  log.info("collector jobs started", { jobs: stopJobs.length });
}

async function stopAllJobs() {
  for (const stop of stopJobs) stop();
  stopJobs = [];
  await flushSamples().catch((err) => log.warn("final sample flush failed", { err }));
}

export async function startCollector() {
  await connectRedis();
  const leadership = startLeadership({ onElected: startJobs, onDemoted: stopAllJobs });
  onShutdown("postgres", closePostgres);
  onShutdown("redis", closeRedis);
  onShutdown("leadership", () => leadership.stop());
  log.info("collector started; waiting for leadership", { instance: config.instanceId });
}
