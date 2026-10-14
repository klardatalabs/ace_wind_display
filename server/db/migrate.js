// Applies the numbered SQL files in ./migrations exactly once, in order. A Postgres advisory
// lock makes concurrent starts safe, and each file's checksum is recorded so an edited,
// already-applied migration is caught instead of silently diverging between environments.
// A file whose first line is "-- migrate:no-transaction" runs outside a transaction.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";

const log = logger("migrate");
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const LOCK_KEY = 8_770_100;

export async function listMigrations() {
  const files = (await fs.readdir(DIR)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return Promise.all(
    files.map(async (file) => {
      const sql = await fs.readFile(path.join(DIR, file), "utf8");
      return {
        version: file.slice(0, 4),
        name: file,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
        transactional: !sql.startsWith("-- migrate:no-transaction"),
      };
    })
  );
}

/** @param {import("pg").Pool} pool */
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS meta;
      CREATE TABLE IF NOT EXISTS meta.schema_migration (
        version     text PRIMARY KEY,
        name        text NOT NULL,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query("SELECT version, name, checksum FROM meta.schema_migration");
    const applied = new Map(rows.map((r) => [r.version, r]));
    const migrations = await listMigrations();
    let count = 0;

    for (const m of migrations) {
      const done = applied.get(m.version);
      if (done) {
        if (done.checksum !== m.checksum) throw new Error(`Migration ${m.name} was changed after it was applied; add a new migration instead`);
        continue;
      }
      log.info("applying migration", { migration: m.name });
      if (m.transactional) await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO meta.schema_migration (version, name, checksum) VALUES ($1, $2, $3)", [m.version, m.name, m.checksum]);
        if (m.transactional) await client.query("COMMIT");
      } catch (err) {
        if (m.transactional) await client.query("ROLLBACK").catch(() => {});
        throw new Error(`Migration ${m.name} failed: ${err.message}`);
      }
      count++;
    }
    log.info("migrations up to date", { applied: count, total: migrations.length });
    return count;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    client.release();
  }
}
