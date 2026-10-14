// Active/standby collectors. The leader holds a Postgres session-level advisory lock on a
// dedicated connection; if the leader process dies, its connection closes, the lock is
// released at once and a standby takes over within one check interval.
//
// While the database is unreachable nobody can take the lock, so a leader that loses its
// connection keeps leading (the live feed to the screens doesn't stop) and re-takes the lock
// when the database returns. If a standby got there first, the old leader steps down.

import pg from "pg";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

const log = logger("collector.leadership");
const LOCK_KEY = 8_770_001;
const CHECK_MS = 5_000;

export function startLeadership({ onElected, onDemoted }) {
  let client = null;
  let leader = false;
  let stopped = false;
  let timer;

  const connect = async () => {
    const c = new pg.Client({ ...config.postgres, password: config.postgres.password, application_name: `weston-wind-leader:${config.instanceId}`, connectionTimeoutMillis: 3_000 });
    c.on("error", (err) => {
      log.warn("leadership connection lost", { err, leader });
      if (client === c) client = null;
    });
    await c.connect();
    return c;
  };

  const check = async () => {
    if (stopped) return;
    try {
      if (!client) client = await connect();
      // Re-taking a lock we already hold on this session is harmless; it returns true.
      const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
      if (rows[0].locked && !leader) {
        leader = true;
        log.info("became the active collector");
        await onElected();
      } else if (!rows[0].locked && leader) {
        leader = false;
        log.warn("another collector holds the lock; stepping down");
        await onDemoted();
      }
    } catch (err) {
      // Database unreachable: keep the current role (see header comment).
      log.debug("leadership check failed", { err, leader });
      if (client) client.end().catch(() => {});
      client = null;
    } finally {
      if (!stopped) timer = setTimeout(check, CHECK_MS);
    }
  };

  check();
  return {
    isLeader: () => leader,
    async stop() {
      stopped = true;
      clearTimeout(timer);
      if (leader) await onDemoted();
      leader = false;
      await client?.end().catch(() => {});
    },
  };
}
