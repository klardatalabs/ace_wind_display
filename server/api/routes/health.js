// Health checks. Public and read-only (nothing secret, nothing that changes state).
//   /api/health/live   the process is up (container liveness)
//   /api/health/ready  this instance should receive traffic (fails while shutting down)
//   /api/health        details: database, Redis, live feed, weather, screens, background jobs

import { Router } from "express";
import { config } from "../../config/index.js";
import { postgresHealthy } from "../../infra/postgres.js";
import { redisHealthy } from "../../infra/redis.js";
import { isShuttingDown } from "../../lib/shutdown.js";
import { currentState, currentEnvironment } from "../liveFeed.js";
import { connectedScreens } from "../realtime/socketHub.js";
import { latestRuns } from "../../db/repositories/jobs.js";

export const healthRoutes = Router();

healthRoutes.get("/live", (_req, res) => res.set("Cache-Control", "no-store").json({ ok: true }));

healthRoutes.get("/ready", (_req, res) => {
  res.set("Cache-Control", "no-store").status(isShuttingDown() ? 503 : 200).json({ ok: !isShuttingDown() });
});

healthRoutes.get("/", async (_req, res) => {
  const state = currentState();
  const environment = currentEnvironment();
  const [database, screens, jobs] = await Promise.all([
    postgresHealthy(),
    connectedScreens(),
    latestRuns().catch(() => []),
  ]);
  // ACE's clock can run a few seconds ahead of ours; never report a negative age.
  const liveAgeSeconds = state?.liveAt ? Math.max(0, Math.round((Date.now() - Date.parse(state.liveAt)) / 1000)) : null;
  res.set("Cache-Control", "no-store").status(database || redisHealthy() ? 200 : 503).json({
    instance: config.instanceId,
    database: database ? "ok" : "unreachable",
    redis: redisHealthy() ? "ok" : "unreachable",
    live: { connected: Boolean(state?.connected), lastReadingAgeSeconds: liveAgeSeconds, source: state?.source ?? "pubsub" },
    weather: environment ? (environment.stale ? "stale" : "ok") : "none",
    screens,
    jobs: jobs.map((j) => ({ job: j.jobId, outcome: j.outcome, startedAt: j.startedAt, finishedAt: j.finishedAt, rowsWritten: j.rowsWritten })),
  });
});
