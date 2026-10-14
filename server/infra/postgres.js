// The PostgreSQL / TimescaleDB connection pool. Every connection gets a statement timeout,
// so one slow query can't hold a connection (and the requests waiting on it) forever.

import pg from "pg";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

const log = logger("postgres");

// Return NUMERIC and BIGINT as JavaScript numbers: every value here fits comfortably.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
// Calendar dates stay "YYYY-MM-DD" strings: turning them into Date objects would shift them
// by the server's own time zone.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: config.postgres.poolSize,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: config.postgres.statementTimeoutMs,
  application_name: `weston-wind:${config.instanceId}`,
});

pool.on("error", (err) => log.warn("idle client error", { err }));

export const query = (text, params) => pool.query(text, params);

/** Runs `work(client)` inside a transaction; rolls back if it throws. */
export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** True when the database answers within the connection timeout. */
export async function postgresHealthy() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

let closing = null;
/** Closes the pool (safe to call more than once). */
export const closePostgres = () => (closing ??= pool.end());
