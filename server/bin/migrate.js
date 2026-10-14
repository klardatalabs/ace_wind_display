// Brings the database up to date: schema migrations, reference data, then the one-time
// import of history from earlier versions. Run before any collector or api process starts
// (the compose "migrate" service does this on every deploy).

import { validateConfig } from "../config/index.js";
import { pool, transaction, closePostgres } from "../infra/postgres.js";
import { migrate } from "../db/migrate.js";
import { seed } from "../db/seed.js";
import { importLegacyHistory } from "../db/legacyImport.js";
import { logger } from "../lib/logger.js";

const log = logger("cli.migrate");

try {
  validateConfig();
  await migrate(pool);
  await transaction(seed);
  await importLegacyHistory(pool);
  log.info("database ready");
} catch (err) {
  log.error("database setup failed", { err });
  process.exitCode = 1;
} finally {
  await closePostgres();
}
