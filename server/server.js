// Weston Wind server entry: HTTP API + WebSocket hub + background data jobs.

import { config } from "./config/env.js";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachSocketHub } from "./realtime/socketHub.js";
import { startPolling } from "./services/turbineState.js";
import { startWeatherPolling } from "./services/environmentService.js";
import {canonicalHistory} from './history/config.js';
import {startHistoryWorker} from './history/worker.js';

const httpServer = createServer(createApp());
attachSocketHub(httpServer);

startPolling();
startWeatherPolling();
if(canonicalHistory) {
  if(process.env.HISTORY_SYNC_ENABLED!=='0')startHistoryWorker();
} else {
  const {startSyncJob}=await import('./jobs/sqliteSyncJob.js');
  const {startTimescaleSyncJob}=await import('./jobs/timescaleSyncJob.js');
  startSyncJob(12 * 60 * 1000);
  startTimescaleSyncJob(12 * 60 * 1000);
}

httpServer.listen(config.port, () => {
  const base = `http://localhost:${config.port}`;
  console.log(`Weston Wind running at ${base}`);
  console.log(`  Website:     ${base}/`);
  console.log(`  Screens:     ${base}/screen/students | /screen/community | /screen/college`);
  console.log(`  Ask Ace:     ${base}/ask/community`);
  console.log(`  Developers:  ${base}/developers`);
  console.log(`  Admin:       ${base}/admin`);
});
