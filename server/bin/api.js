// Entry point: one api instance (run several behind the load balancer).
import { validateConfig } from "../config/index.js";
import { installSignalHandlers } from "../lib/shutdown.js";
import { startApi } from "../api/index.js";

validateConfig();
installSignalHandlers();
await startApi();
