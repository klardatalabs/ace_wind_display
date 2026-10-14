// Runs collector jobs on intervals. A job never overlaps itself (the next run is scheduled
// after the previous one finishes), failures back off exponentially up to a cap, and every
// job can be stopped (when this collector stops being the leader, or shuts down).

import { logger } from "../lib/logger.js";

const log = logger("collector.scheduler");

/**
 * @param {string} name
 * @param {number} intervalMs
 * @param {() => Promise<void>} fn
 * @param {{ maxBackoffMs?: number, initialDelayMs?: number }} [options]
 */
export function every(name, intervalMs, fn, { maxBackoffMs = 5 * 60_000, initialDelayMs = 0 } = {}) {
  let timer;
  let stopped = false;
  let failures = 0;

  const run = async () => {
    if (stopped) return;
    const started = Date.now();
    try {
      await fn();
      if (failures) log.info("job recovered", { job: name, after: failures });
      failures = 0;
    } catch (err) {
      failures++;
      // Log the first failure and then every tenth, so an outage doesn't flood the logs.
      if (failures === 1 || failures % 10 === 0) log.warn("job failed", { job: name, failures, err });
    }
    if (stopped) return;
    const backoff = failures ? Math.min(maxBackoffMs, intervalMs * 2 ** Math.min(failures - 1, 10)) : intervalMs;
    timer = setTimeout(run, Math.max(0, backoff - (failures ? 0 : Date.now() - started)));
  };

  timer = setTimeout(run, initialDelayMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
