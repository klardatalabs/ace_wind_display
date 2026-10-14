// Local development: migrations, the collector and one api instance in a single process.
import { validateConfig } from "../config/index.js";
import { installSignalHandlers } from "../lib/shutdown.js";
import { pool, transaction } from "../infra/postgres.js";
import { migrate } from "../db/migrate.js";
import { seed } from "../db/seed.js";
import { startCollector } from "../collector/index.js";
import { startApi } from "../api/index.js";

validateConfig();
installSignalHandlers();
await migrate(pool);
await transaction(seed);
await startCollector();
await startApi();
