// Entry point: a collector (run one, or two for a hot standby).
import { validateConfig } from "../config/index.js";
import { installSignalHandlers } from "../lib/shutdown.js";
import { startCollector } from "../collector/index.js";

validateConfig();
installSignalHandlers();
await startCollector();
